/**
 * Image diagnosis: forwards uploads to the ML service, stores results in MongoDB,
 * and can save/link a diagnosis to a farmer’s field. Farmers only.
 */
const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')
const rateLimit = require('express-rate-limit')
const Diagnosis = require('../models/Diagnosis')
const { requireAuth, requireRole } = require('../middleware/auth')
const { send_admin_broadcast_email } = require('../email_service')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

const diagnose_limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many diagnosis requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
})

function get_ml_service_url() {
  const url = process.env.ML_SERVICE_URL || ''
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim().replace(/\/+$/, '')
  }
  return ''
}

function validate_image_file(file) {
  if (!file) {
    return { valid: false, message: 'Image is required in field "image"' }
  }
  
  const max_size = 10 * 1024 * 1024
  if (file.size > max_size) {
    return { valid: false, message: 'Image size exceeds 10MB limit' }
  }
  
  const allowed_types = ['image/jpeg', 'image/jpg', 'image/png']
  if (!allowed_types.includes(file.mimetype)) {
    return { valid: false, message: 'Invalid image type. Only JPG and PNG are allowed' }
  }
  
  return { valid: true }
}

function get_error_message(status) {
  if (status === 404) return 'ML service unavailable'
  if (status === 415) return 'Unsupported image format'
  if (status === 429) return 'Service temporarily busy'
  return 'Diagnosis request failed'
}

router.post('/', requireAuth, requireRole(['farmer']), diagnose_limiter, upload.single('image'), async (req, res) => {
  const validation = validate_image_file(req.file)
  if (!validation.valid) {
    res.status(400).json({ message: validation.message })
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
    if (!ml_resp?.data) {
      res.status(502).json({ message: 'Empty response from ML service' })
      return
    }

    const field_id = req.body && req.body.field_id ? req.body.field_id : null

    try {
      const diagnosis_record = new Diagnosis({
        user_id: req.auth.userId,
        diagnosis: ml_resp.data.diagnosis,
        confidence: ml_resp.data.confidence,
        alternatives: ml_resp.data.alternatives || [],
        recommendations: ml_resp.data.recommendations || [],
        processing_ms: ml_resp.data.processing_ms,
        field_id: field_id || undefined
      })
      await diagnosis_record.save()

      // SLA: if ML took >15s, email ops in the background so the client still gets an immediate JSON body.
      if (typeof diagnosis_record.processing_ms === 'number' && diagnosis_record.processing_ms > 15000) {
        const sla_ms = diagnosis_record.processing_ms
        const sla_label = diagnosis_record.diagnosis
        const sla_time = new Date().toISOString()
        ;(async () => {
          try {
            const admin_email = process.env.ADMIN_EMAIL || process.env.SUPPORT_TO_EMAIL || 'zarakqadirkhan02@gmail.com'
            const processing_s = (sla_ms / 1000).toFixed(1) + 's'
            await send_admin_broadcast_email({
              recipient_email: admin_email,
              subject: 'SLA Breach: Diagnosis exceeded 15s threshold',
              message: [
                'SLA breach detected in AgriQual diagnosis pipeline.',
                '',
                'Processing time: ' + processing_s,
                'Diagnosis: ' + sla_label,
                'Timestamp: ' + sla_time
              ].join('\n')
            })
          } catch (email_err) {
            console.error('SLA breach alert email failed:', email_err.message || email_err)
          }
        })()
      }

      res.json({ ...ml_resp.data, diagnosisId: diagnosis_record._id.toString() })
    } catch (error_) {
      console.error('Failed to save diagnosis to database:', error_.message || error_)
      res.json(ml_resp.data)
    }
  } catch (err) {
    console.error('Diagnosis error:', err.message || err)
    const status = err?.response?.status ?? null
    const safe_message = get_error_message(status)
    res.status(502).json({ message: safe_message })
  }
})

router.post('/save-and-link', requireAuth, requireRole(['farmer']), async (req, res) => {
  const { diagnosis, confidence, alternatives, recommendations, processing_ms, field_id } = req.body || {}
  if (!diagnosis || !field_id) {
    res.status(400).json({ message: 'diagnosis and field_id are required' })
    return
  }
  const Field = require('../models/Field')
  const mongoose = require('mongoose')
  try {
    const field = await Field.findOne({ _id: field_id, user_id: req.auth.userId })
    if (!field) {
      res.status(404).json({ message: 'Field not found' })
      return
    }
    const diagnosis_record = new Diagnosis({
      user_id: req.auth.userId,
      diagnosis: typeof diagnosis === 'string' ? diagnosis : String(diagnosis),
      confidence: typeof confidence === 'number' ? confidence : 0,
      alternatives: Array.isArray(alternatives) ? alternatives : [],
      recommendations: Array.isArray(recommendations) ? recommendations : [],
      processing_ms: typeof processing_ms === 'number' ? processing_ms : undefined,
      field_id: new mongoose.Types.ObjectId(field_id)
    })
    await diagnosis_record.save()
    res.json({ diagnosisId: diagnosis_record._id.toString() })
  } catch (err) {
    console.error('Save-and-link diagnosis error:', err.message || err)
    res.status(500).json({ message: 'Failed to save and link diagnosis' })
  }
})

module.exports = router
