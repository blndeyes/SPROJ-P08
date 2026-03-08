const express = require('express')
const OpenAI = require('openai')

const { retrieve_chunks, build_evidence_block } = require('../lib/rag')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

let openai_client = null

function get_openai_client() {
  if (openai_client) {
    return openai_client
  }

  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  openai_client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  return openai_client
}

function build_system_prompt(diagnosis_payload, auth) {
  const lines = []

  lines.push(
    'You are AgriQual, a helpful assistant for wheat farmers in Pakistan. ' +
      'Use simple, clear language. Focus on practical field advice that small farmers can follow.'
  )

  if (auth && auth.email) {
    lines.push('The current authenticated user email is: ' + auth.email + '.')
  }

  if (diagnosis_payload && typeof diagnosis_payload === 'object') {
    const diagnosis_label = diagnosis_payload.diagnosis || 'unknown'
    const confidence_value =
      typeof diagnosis_payload.confidence === 'number'
        ? (diagnosis_payload.confidence * 100).toFixed(1) + '%'
        : 'unknown'

    lines.push(
      'The latest image analysis result for this user is as follows. ' +
        'You must treat this as a best-effort automated estimate, not a perfect ground truth.'
    )
    lines.push('Primary diagnosis: ' + diagnosis_label + '.')
    lines.push('Model confidence: ' + confidence_value + '.')

    if (Array.isArray(diagnosis_payload.recommendations) && diagnosis_payload.recommendations.length > 0) {
      const recommendations_text = diagnosis_payload.recommendations.join(' • ')
      lines.push('Model recommendations: ' + recommendations_text + '.')
    }

    if (Array.isArray(diagnosis_payload.alternatives) && diagnosis_payload.alternatives.length > 0) {
      const mapped_alternatives = diagnosis_payload.alternatives
        .map(function (alternative_item) {
          const label = alternative_item && alternative_item.label ? String(alternative_item.label) : 'unknown'
          if (typeof alternative_item.confidence === 'number') {
            const alternative_confidence = (alternative_item.confidence * 100).toFixed(1) + '%'
            return label + ' (' + alternative_confidence + ')'
          }
          return label
        })
        .join(' • ')
      lines.push('Alternative diagnoses considered by the model: ' + mapped_alternatives + '.')
    }
  } else {
    lines.push(
      'There is no structured diagnosis payload for this conversation. ' +
        'Answer as a general crop health assistant for wheat in Pakistan.'
    )
  }

  lines.push(
    'You will also receive an EVIDENCE block from trusted agriculture documents. ' +
      'You must answer using ONLY the evidence. ' +
      'If evidence is missing or insufficient, say so and ask 1-2 short follow-up questions. ' +
      'Cite claims like [1], [2]. Do not invent citations.'
  )

  lines.push(
    'Always include a short safety note: confirm locally with an agronomist or extension worker before chemical use. ' +
      'Avoid giving precise chemical doses unless evidence explicitly states it.'
  )

  return lines.join(' ')
}

function normalize_messages(raw_messages) {
  if (!Array.isArray(raw_messages)) {
    return []
  }

  const normalized = []

  raw_messages.forEach(function (raw_item) {
    if (!raw_item) {
      return
    }

    const role_value = raw_item.role === 'assistant' ? 'assistant' : 'user'
    const content_value = raw_item.content != null ? String(raw_item.content) : ''

    if (content_value.trim().length === 0) {
      return
    }

    normalized.push({
      role: role_value,
      content: content_value
    })
  })

  return normalized
}

router.post('/', requireAuth, async function (request, response) {
  try {
    const client = get_openai_client()
    if (!client) {
      response.status(501).json({
        message: 'Chat service not configured',
        detail: 'Set OPENAI_API_KEY in the backend environment'
      })
      return
    }

    const request_body = request.body || {}
    const raw_messages = request_body.messages || []
    const diagnosis_payload = request_body.diagnosis || null
    const single_message = request_body.message || null

    let chat_messages = normalize_messages(raw_messages)

    if (chat_messages.length === 0 && single_message) {
      const single_text = String(single_message)
      if (single_text.trim().length > 0) {
        chat_messages.push({
          role: 'user',
          content: single_text.trim()
        })
      }
    }

    if (chat_messages.length === 0) {
      response.status(400).json({ message: 'At least one user message is required' })
      return
    }

    const last_user_message = chat_messages[chat_messages.length - 1].content
    const diagnosis_label = diagnosis_payload && diagnosis_payload.diagnosis ? String(diagnosis_payload.diagnosis) : ''

    const rag_query = (diagnosis_label ? ('Diagnosis: ' + diagnosis_label + '\n') : '') + 'Question: ' + last_user_message
    const retrieved_chunks = await retrieve_chunks(rag_query, 6)
    const evidence_block = build_evidence_block(retrieved_chunks)

    const system_prompt = build_system_prompt(diagnosis_payload, request.auth)
    const model_name = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

    const all_messages = [
      { role: 'system', content: system_prompt },
      { role: 'user', content: 'EVIDENCE:\n' + (evidence_block || 'No evidence found in the knowledge base.') },
      { role: 'user', content: 'USER QUESTION:\n' + last_user_message }
    ]

    const completion = await client.chat.completions.create({
      model: model_name,
      messages: all_messages,
      temperature: 0.3,
      max_tokens: 650
    })

    const first_choice = completion && completion.choices && completion.choices[0] ? completion.choices[0] : null
    const assistant_message =
      first_choice && first_choice.message && first_choice.message.content
        ? String(first_choice.message.content)
        : ''

    if (!assistant_message) {
      response.status(502).json({ message: 'Empty response from AI service' })
      return
    }

    response.json({
      reply: assistant_message,
      sources: retrieved_chunks.map(function (c, idx) {
        return {
          id: idx + 1,
          source: c.source,
          tags: c.tags || [],
          text: c.text
        }
      })
    })
  } catch (error) {
    console.error('Chat route error:', error.message || error)
    response.status(502).json({
      message: 'Chat service temporarily unavailable'
    })
  }
})

module.exports = router
