const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')
const jwt = require('jsonwebtoken')
const Diagnosis = require('../models/Diagnosis')

const router = express.Router()
// store uploads in memory, limit to 8mb
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

function get_auth_user(request) {
  // extract and verify jwt from bearer header
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) {
    return null
  }
  const token = auth_header.slice(7)
  if (!token) {
    return null
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return payload
  } catch (error) {
    return null
  }
}

function get_ml_service_url() {
  // normalize base url and strip trailing slashes
  const url = process.env.ML_SERVICE_URL || ''
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim().replace(/\/+$/, '')
  }
  return ''
}

router.post('/', upload.single('image'), async (req, res) => {
  // validate that an image file was sent
  if (!req.file) {
    res.status(400).json({ message: 'Image is required in field "image"' })
    return
  }
  
  // only authenticated users can request a diagnosis
  const auth_user = get_auth_user(req)
  if (!auth_user) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  
  // ensure the ml service base url is configured
  const ml_base = get_ml_service_url()
  if (!ml_base) {
    res.status(501).json({ message: 'ML service not configured', detail: 'Set ML_SERVICE_URL in the backend environment' })
    return
  }
  try {
    // forward the image as multipart form data to the ml api
    const form = new FormData()
    const filename = req.file.originalname || 'uploaded.jpg'
    const content_type = req.file.mimetype || 'image/jpeg'
    form.append('image', req.file.buffer, { filename, contentType: content_type })
    const url = `${ml_base}/api/diagnose`
    const ml_resp = await axios.post(url, form, { headers: form.getHeaders(), timeout: 30000 })
    if (!ml_resp || !ml_resp.data) {
      res.status(502).json({ message: 'Empty response from ML service' })
      return
    }
    
    // save diagnosis to database so user can view history later
    try {
      const diagnosis_record = new Diagnosis({
        user_id: auth_user.userId,
        diagnosis: ml_resp.data.diagnosis,
        confidence: ml_resp.data.confidence,
        alternatives: ml_resp.data.alternatives || [],
        recommendations: ml_resp.data.recommendations || [],
        processing_ms: ml_resp.data.processing_ms
      })
      await diagnosis_record.save()
    } catch (db_err) {
      console.error('Failed to save diagnosis to database:', db_err.message || db_err)
      // continue even if saving fails, the user still gets the result
    }
    
    res.json(ml_resp.data)
  } catch (err) {
    // map upstream errors to a safe message for the client
    const status = err && err.response && err.response.status ? err.response.status : null
    const data = err && err.response && err.response.data ? err.response.data : null
    const safe_message = status === 404 ? 'ML endpoint not found' : status === 415 ? 'Unsupported image type' : status === 429 ? 'ML service rate-limited' : status ? `ML service error (${status})` : 'Network error contacting ML service'
    res.status(502).json({ message: 'Diagnosis failed', detail: safe_message, upstream: data })
  }
})

module.exports = router
