const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')
const jwt = require('jsonwebtoken')
const Diagnosis = require('../models/Diagnosis')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }) // In-memory upload; max 8MB per image

function get_auth_user(request) {
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) { // Expect "Authorization: Bearer <token>"
    return null
  }
  const token = auth_header.slice(7) // Drop the "Bearer " prefix
  if (!token) {
    return null
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) // Verify and decode JWT
    return payload
  } catch (error) {
    return null
  }
}

function get_ml_service_url() {
  const url = process.env.ML_SERVICE_URL || ''
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim().replace(/\/+$/, '') // Normalize and remove trailing slashes
  }
  return ''
}

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) { // Require an image in the "image" field
    res.status(400).json({ message: 'Image is required in field "image"' })
    return
  }
  
  const auth_user = get_auth_user(req)
  if (!auth_user) { // Must be logged in
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  
  const ml_base = get_ml_service_url()
  if (!ml_base) { // Backend not configured to reach ML service
    res.status(501).json({ message: 'ML service not configured', detail: 'Set ML_SERVICE_URL in the backend environment' })
    return
  }
  try {
    const form = new FormData() // Build multipart/form data for the ML API
    const filename = req.file.originalname || 'uploaded.jpg'
    const content_type = req.file.mimetype || 'image/jpeg'
    form.append('image', req.file.buffer, { filename, contentType: content_type }) // Send raw bytes from memory
    const url = `${ml_base}/api/diagnose`
    const ml_resp = await axios.post(url, form, { headers: form.getHeaders(), timeout: 30000 }) // 30s timeout for inference
    if (!ml_resp || !ml_resp.data) {
      res.status(502).json({ message: 'Empty response from ML service' })
      return
    }
    
    // Save diagnosis to database
    try {
      const diagnosis_record = new Diagnosis({
        user_id: auth_user.userId, // Link result to current user
        diagnosis: ml_resp.data.diagnosis,
        confidence: ml_resp.data.confidence,
        alternatives: ml_resp.data.alternatives || [],
        recommendations: ml_resp.data.recommendations || [],
        processing_ms: ml_resp.data.processing_ms
      })
      await diagnosis_record.save() // Best-effort; failure here won't block the response
    } catch (db_err) {
      console.error('Failed to save diagnosis to database:', db_err.message || db_err)
      // Continue even if saving fails - user still gets result
    }
    
    res.json(ml_resp.data)
  } catch (err) {
    const status = err && err.response && err.response.status ? err.response.status : null
    const data = err && err.response && err.response.data ? err.response.data : null
    const safe_message = status === 404 ? 'ML endpoint not found' : status === 415 ? 'Unsupported image type' : status === 429 ? 'ML service rate-limited' : status ? `ML service error (${status})` : 'Network error contacting ML service' // Friendly summary without leaking internals
    res.status(502).json({ message: 'Diagnosis failed', detail: safe_message, upstream: data })
  }
})

module.exports = router
