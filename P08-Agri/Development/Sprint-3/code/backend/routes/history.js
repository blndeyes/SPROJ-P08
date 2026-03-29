const express = require('express')
const mongoose = require('mongoose')
const Diagnosis = require('../models/Diagnosis')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()

// RBAC: only farmers can view their diagnosis history
// Get all diagnoses for the authenticated user
router.get('/', requireAuth, requireRole(['farmer']), async (req, res) => {
  try {
    const userId = req.auth.userId

    let limit = Number.parseInt(req.query.limit) || 50
    if (Number.isNaN(limit) || limit <= 0) {
      limit = 50
    }
    if (limit > 50) {
      limit = 50
    }

    let skip = Number.parseInt(req.query.skip) || 0
    if (Number.isNaN(skip) || skip < 0) {
      skip = 0
    }

    const diagnoses = await Diagnosis.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .select('-__v')
      .lean()

    const total = await Diagnosis.countDocuments({ user_id: userId })

    res.json({
      diagnoses,
      total,
      limit,
      skip
    })
  } catch (error) {
    console.error('Error fetching diagnosis history:', error.message || error)
    res.status(500).json({ message: 'Request failed' })
  }
})

// Get a specific diagnosis by ID (farmer only, own records)
router.get('/:id', requireAuth, requireRole(['farmer']), async (req, res) => {
  try {
    const userId = req.auth.userId

    // Validate and sanitize the ID parameter to prevent NoSQL injection
    const rawId = req.params.id
    if (!rawId || typeof rawId !== 'string' || !mongoose.Types.ObjectId.isValid(rawId)) {
      return res.status(400).json({ message: 'Invalid diagnosis ID format' })
    }

    const sanitizedObjectId = new mongoose.Types.ObjectId(rawId)

    const diagnosis = await Diagnosis.findOne({
      _id: sanitizedObjectId,
      user_id: userId
    }).select('-__v').lean()

    if (!diagnosis) {
      return res.status(404).json({ message: 'Diagnosis not found' })
    }

    res.json(diagnosis)
  } catch (error) {
    console.error('Error fetching diagnosis:', error.message || error)
    res.status(500).json({ message: 'Request failed' })
  }
})

module.exports = router
