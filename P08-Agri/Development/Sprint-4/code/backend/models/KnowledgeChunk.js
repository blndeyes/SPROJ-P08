/**
 * Embedded text slice from PDFs for RAG search in the chat feature.
 */
const mongoose = require('mongoose')

const knowledge_chunk_schema = new mongoose.Schema({
  text: { type: String, required: true },
  source: { type: String, required: true },
  tags: [{ type: String }],
  embedding: [{ type: Number, required: true }],
  created_at: { type: Date, default: Date.now }
})

knowledge_chunk_schema.index({ tags: 1 })

module.exports = mongoose.model('KnowledgeChunk', knowledge_chunk_schema)
