const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

function get_ml_service_url() {
  const url = process.env.ML_SERVICE_URL || ''
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim().replace(/\/+$/, '')
  }
  return ''
}

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'Image is required in field "image"' })
    return
  }
  const ml_base = get_ml_service_url()
  if (!ml_base) {
    res.status(501).json({ message: 'ML service not configured', detail: 'Set ML_SERVICE_URL in the backend environment' })
    return
  }
  try {
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
    res.json(ml_resp.data)
  } catch (err) {
    const status = err && err.response && err.response.status ? err.response.status : null
    const data = err && err.response && err.response.data ? err.response.data : null
    const safe_message = status === 404 ? 'ML endpoint not found' : status === 415 ? 'Unsupported image type' : status === 429 ? 'ML service rate-limited' : status ? `ML service error (${status})` : 'Network error contacting ML service'
    res.status(502).json({ message: 'Diagnosis failed', detail: safe_message, upstream: data })
  }
})

module.exports = router
