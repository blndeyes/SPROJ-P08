const express = require('express')
const jwt = require('jsonwebtoken')
const Diagnosis = require('../models/Diagnosis')

const router = express.Router()

function get_auth_user(request) {
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) { // Expect an "Authorization: Bearer <token>" header
    return null
  }
  const token = auth_header.slice(7) // Remove "Bearer " to get the raw token
  if (!token) {
    return null
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) // Verify token and decode user info
    return payload
  } catch (error) {
    return null
  }
}

// Get all diagnoses for the authenticated user
router.get('/', async (req, res) => {
  try {
    const auth_user = get_auth_user(req)
    if (!auth_user) { // Must be logged in
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const limit = parseInt(req.query.limit) || 50
    const skip = parseInt(req.query.skip) || 0

    // Only fetch the current user's diagnoses
    const diagnoses = await Diagnosis.find({ user_id: auth_user.userId })
      .sort({ created_at: -1 }) // Newest first
      .limit(limit)             // Page size
      .skip(skip)               // Offset
      .select('-__v')           // Hide Mongoose metadata
      .lean()                   // Return plain objects (faster for read-only)

    const total = await Diagnosis.countDocuments({ user_id: auth_user.userId }) // For paging UI

    res.json({
      diagnoses,
      total,
      limit,
      skip
    })
  } catch (error) {
    console.error('Error fetching diagnosis history:', error.message || error)
    res.status(500).json({ message: 'Failed to fetch diagnosis history' })
  }
})

// Get a specific diagnosis by ID
router.get('/:id', async (req, res) => {
  try {
    const auth_user = get_auth_user(req)
    if (!auth_user) { // Must be logged in
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Fetch a single diagnosis that belongs to this user
    const diagnosis = await Diagnosis.findOne({
      _id: req.params.id,
      user_id: auth_user.userId
    }).select('-__v').lean()

    if (!diagnosis) {
      return res.status(404).json({ message: 'Diagnosis not found' })
    }

    res.json(diagnosis)
  } catch (error) {
    console.error('Error fetching diagnosis:', error.message || error)
    res.status(500).json({ message: 'Failed to fetch diagnosis' })
  }
})

module.exports = router
