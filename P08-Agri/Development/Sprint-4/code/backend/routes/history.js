const express = require('express')
const mongoose = require('mongoose')
const { requireAuth } = require('../middleware/auth')
const Diagnosis = require('../models/Diagnosis')
const Field = require('../models/Field')

const router = express.Router()

router.get('/', requireAuth, async function (request, response) {
  try {
    const limit_raw = Number(request.query.limit)
    const skip_raw = Number(request.query.skip)

    const limit = Number.isFinite(limit_raw) && limit_raw > 0 ? Math.min(limit_raw, 100) : 50
    const skip = Number.isFinite(skip_raw) && skip_raw >= 0 ? skip_raw : 0

    const query = { user_id: request.auth.userId }

    const [diagnoses, total] = await Promise.all([
      Diagnosis.find(query)
        .sort({ created_at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Diagnosis.countDocuments(query)
    ])

    response.json({
      diagnoses,
      total,
      limit,
      skip
    })
  } catch (error) {
    console.error('History route error:', error.message || error)
    response.status(500).json({
      message: 'Failed to load diagnosis history'
    })
  }
})

router.get('/:id', requireAuth, async function (request, response) {
  try {
    const diagnosis = await Diagnosis.findOne({
      _id: request.params.id,
      user_id: request.auth.userId
    }).lean()

    if (!diagnosis) {
      response.status(404).json({ message: 'Diagnosis not found' })
      return
    }

    response.json(diagnosis)
  } catch (error) {
    console.error('History detail route error:', error.message || error)
    response.status(500).json({
      message: 'Failed to load diagnosis details'
    })
  }
})

router.patch('/:id/field', requireAuth, async function (request, response) {
  try {
    const diagnosis = await Diagnosis.findOne({
      _id: request.params.id,
      user_id: request.auth.userId
    })
    if (!diagnosis) {
      response.status(404).json({ message: 'Diagnosis not found' })
      return
    }
    const { field_id } = request.body || {}
    if (field_id === null || field_id === '') {
      diagnosis.field_id = undefined
      await diagnosis.save()
      return response.json({ ...diagnosis.toObject(), field_id: null })
    }
    if (!field_id) {
      return response.status(400).json({ message: 'field_id is required' })
    }
    const field = await Field.findOne({
      _id: field_id,
      user_id: request.auth.userId
    })
    if (!field) {
      return response.status(404).json({ message: 'Field not found' })
    }
    diagnosis.field_id = new mongoose.Types.ObjectId(field_id)
    await diagnosis.save()
    response.json(diagnosis)
  } catch (error) {
    console.error('Link diagnosis to field error:', error.message || error)
    response.status(500).json({ message: 'Failed to link diagnosis to field' })
  }
})

module.exports = router