/**
 * Offline RAG pipeline: PDFs → text → overlapping paragraph chunks → embeddings → MongoDB.
 * Run: node scripts/ingest_pdfs.js [folder]. Default folder is ../rag_docs (sibling of scripts/).
 * Re-running inserts additional chunks (no dedup); clear the collection first if you need a fresh index.
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const OpenAI = require('openai')

const KnowledgeChunk = require('../models/KnowledgeChunk')

const pdf_parse_module = require('pdf-parse')
// Package may export the parser as default (ESM interop) or as the module itself.
const pdf_parse = typeof pdf_parse_module === 'function' ? pdf_parse_module : pdf_parse_module.default

const mongo_uri = process.env.MONGODB_URI || process.env.MONGO_URI
const openai_api_key = process.env.OPENAI_API_KEY
const embedding_model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

// PDF extract often has runs of spaces and broken newlines; normalize so chunk boundaries stay stable.
function normalize_whitespace(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Grow chunks by whole paragraphs until ~max_chars, then start a new chunk (keeps sentences together for retrieval quality).
function split_into_chunks(text, max_chars) {
  const limit = typeof max_chars === 'number' ? max_chars : 1400
  const clean_text = normalize_whitespace(text)

  const paragraphs = clean_text.split('\n\n')
  const chunks = []

  let buffer = ''
  let i = 0

  while (i < paragraphs.length) {
    const paragraph = paragraphs[i].trim()

    if (paragraph.length === 0) {
      i = i + 1
      continue
    }

    if (buffer.length === 0) {
      buffer = paragraph
      i = i + 1
      continue
    }

    if (buffer.length + 2 + paragraph.length <= limit) {
      buffer = buffer + '\n\n' + paragraph
      i = i + 1
      continue
    }

    chunks.push(buffer)
    buffer = paragraph
    i = i + 1
  }

  if (buffer.length > 0) {
    chunks.push(buffer)
  }

  return chunks
}

// OpenAI embeddings API returns data[0].embedding; we defensively check each level for clearer failures upstream.
async function embed_text(openai_client, text) {
  const input_text = String(text || '').trim()
  if (input_text.length === 0) {
    return null
  }

  const result = await openai_client.embeddings.create({
    model: embedding_model,
    input: input_text
  })

  if (!result) {
    return null
  }

  if (!result.data) {
    return null
  }

  if (!result.data[0]) {
    return null
  }

  if (!result.data[0].embedding) {
    return null
  }

  return result.data[0].embedding
}

// Filename heuristics help the chat RAG prefer disease-relevant chunks when the query is vague (not used for strict filtering).
function infer_tags_from_filename(file_name) {
  const lower = String(file_name || '').toLowerCase()

  const tags = ['wheat']

  if (lower.includes('rust')) {
    tags.push('Black Rust')
    tags.push('Brown Rust')
    tags.push('Yellow Rust')
    tags.push('rust')
  }

  if (lower.includes('aphid')) {
    tags.push('Aphid')
    tags.push('aphid')
  }

  if (lower.includes('fusarium') || lower.includes('fhb') || lower.includes('head blight')) {
    tags.push('Fusarium Head Blight')
    tags.push('fhb')
  }

  if (lower.includes('septoria')) {
    tags.push('Septoria')
  }

  if (lower.includes('tan') && lower.includes('spot')) {
    tags.push('Tan spot')
  }

  if (lower.includes('mildew')) {
    tags.push('Mildew')
  }

  if (lower.includes('smut') || lower.includes('bunt')) {
    tags.push('Smut')
  }

  if (lower.includes('root') && lower.includes('rot')) {
    tags.push('Common Root Rot')
  }

  return tags
}

async function ingest_pdf(openai_client, pdf_path) {
  const file_buffer = fs.readFileSync(pdf_path)

  if (typeof pdf_parse !== 'function') {
    throw new Error('pdf-parse is not a function')
  }

  const parsed = await pdf_parse(file_buffer)

  const full_text = normalize_whitespace(parsed && parsed.text ? parsed.text : '')
  // Skip scanned/image-only PDFs or empty pages — nothing useful to embed.
  if (full_text.length < 50) {
    return { inserted: 0, skipped: 1 }
  }

  const source = path.basename(pdf_path)
  const tags = infer_tags_from_filename(source)

  const chunks = split_into_chunks(full_text, 1400)

  let inserted = 0
  let index = 0

  while (index < chunks.length) {
    const chunk_text = chunks[index]

    // Tiny chunks add noise to vector search and rarely carry standalone meaning.
    if (chunk_text.length < 120) {
      index = index + 1
      continue
    }

    const embedding = await embed_text(openai_client, chunk_text)
    if (!embedding) {
      index = index + 1
      continue
    }

    await KnowledgeChunk.create({
      text: chunk_text,
      source,
      tags,
      embedding
    })

    inserted = inserted + 1
    index = index + 1
  }

  return { inserted, skipped: 0 }
}

async function main() {
  if (!mongo_uri) {
    console.error('Missing MONGODB_URI / MONGO_URI')
    process.exit(1)
  }

  if (!openai_api_key) {
    console.error('Missing OPENAI_API_KEY')
    process.exit(1)
  }

  // Second CLI arg = PDF directory; otherwise default beside backend (rag_docs).
  const docs_folder = process.argv[2] ? String(process.argv[2]) : path.resolve(__dirname, '..', 'rag_docs')

  if (!fs.existsSync(docs_folder)) {
    console.error('Folder not found:', docs_folder)
    process.exit(1)
  }

  const file_names = fs.readdirSync(docs_folder).filter(function (name) {
    return name.toLowerCase().endsWith('.pdf')
  })

  if (file_names.length === 0) {
    console.error('No PDFs found in:', docs_folder)
    process.exit(1)
  }

  await mongoose.connect(mongo_uri)

  const openai_client = new OpenAI({ apiKey: openai_api_key })

  let total_inserted = 0
  let i = 0

  while (i < file_names.length) {
    const file_name = file_names[i]
    const pdf_path = path.resolve(docs_folder, file_name)

    const result = await ingest_pdf(openai_client, pdf_path)

    console.log('Ingested:', file_name, 'inserted=', result.inserted)
    total_inserted = total_inserted + result.inserted

    i = i + 1
  }

  console.log('Done. Total inserted chunks:', total_inserted)
  await mongoose.disconnect()
}

main()
  .then(function () {})
  .catch(function (error) {
    console.error('Ingest error:', error && error.message ? error.message : error)
    process.exit(1)
  })
