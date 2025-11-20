const express = require('express')
const jwt = require('jsonwebtoken')
const Complaint = require('../models/Complaint')
const { send_help_email } = require('../email_service')

const router = express.Router()

function get_auth_user(request) {
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) { // Expect an "Authorization: Bearer <token>" header
    return null
  }
  const token = auth_header.slice(7) // Remove the "Bearer " prefix to get the raw token
  if (!token) {
    return null
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) // Verify the token and get decoded user info
    return payload
  } catch (error) {
    return null
  }
}

router.post('/complaints', async function (request, response) {
  try {
    const auth_user = get_auth_user(request)
    if (!auth_user) { // Stop if the user isn't logged in (no valid token)
      return response.status(401).json({ message: 'Unauthorized' })
    }

    // Read the subject and message the user typed
    const subject_raw = request.body && request.body.subject ? request.body.subject : ''
    const message_raw = request.body && request.body.message ? request.body.message : ''

    const subject = String(subject_raw).trim()
    const message = String(message_raw).trim()

    if (!subject || !message) { // Both fields are required
      return response.status(400).json({ message: 'Subject and message are required' })
    }

    const complaint = new Complaint({
      userEmail: auth_user.email, // Fill in who filed the complaint (from the token)
      userId: auth_user.userId,   // Fill in who filed the complaint (from the token)
      subject,
      message,
      status: 'not addressed'
    })

    // Save it and email our support inbox
    await complaint.save()
    await send_help_email({
      subject,
      message,
      userEmail: auth_user.email
    })

    // Return a simple confirmation plus what we stored
    return response.status(201).json({
      message: 'Complaint submitted successfully',
      complaint: {
        id: complaint._id,
        userEmail: complaint.userEmail,
        subject: complaint.subject,
        message: complaint.message,
        status: complaint.status,
        createdAt: complaint.createdAt
      }
    })
  } catch (error) {
    const msg = error && error.message ? error.message : error
    console.error('Help complaint error:', msg)
    return response.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
