/**
 * Retrieval for chat: embed query, score KnowledgeChunk vectors, return top passages.
 */
const OpenAI = require('openai')
const KnowledgeChunk = require('../models/KnowledgeChunk')

const openai_client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const embedding_model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

function dot_product(a, b) {
  let sum = 0
  let i = 0
  while (i < a.length && i < b.length) {
    sum = sum + a[i] * b[i]
    i = i + 1
  }
  return sum
}

function vector_norm(a) {
  let sum_sq = 0
  let i = 0
  while (i < a.length) {
    sum_sq = sum_sq + a[i] * a[i]
    i = i + 1
  }
  return Math.sqrt(sum_sq)
}

function cosine_similarity(a, b) {
  const denom = vector_norm(a) * vector_norm(b)
  if (denom === 0) {
    return 0
  }
  return dot_product(a, b) / denom
}

async function embed_query(text) {
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

async function retrieve_chunks(query_text, top_k) {
  const k = typeof top_k === 'number' ? top_k : 6
  const query_embedding = await embed_query(query_text)

  if (!query_embedding) {
    return []
  }

  const candidates = await KnowledgeChunk.find({}).limit(1000).lean()
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return []
  }

  const scored = candidates.map(function (chunk) {
    const score = cosine_similarity(query_embedding, chunk.embedding || [])
    return { chunk, score }
  })

  scored.sort(function (a, b) {
    return b.score - a.score
  })

  return scored.slice(0, k).map(function (item) {
    return item.chunk
  })
}

function build_evidence_block(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return ''
  }

  const lines = []
  let i = 0
  while (i < chunks.length) {
    const chunk = chunks[i]
    lines.push('[' + (i + 1) + '] ' + chunk.text)
    i = i + 1
  }
  return lines.join('\n\n')
}

module.exports = {
  retrieve_chunks,
  build_evidence_block
}
