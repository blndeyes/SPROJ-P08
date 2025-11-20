const express = require('express')
const jwt = require('jsonwebtoken')
const Complaint = require('../models/Complaint')
const { send_help_email } = require('../email_service')

const router = express.Router()

function get_auth_user(request) {
  // read bearer token from the auth header and verify it
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) {
    return null
  }
  const token = auth_header.slice(7)
  if (!token) {
    return null
  }
  try {
    // token payload includes user id and email
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return payload
  } catch (error) {
    return null
  }
}

router.post('/complaints', async function (request, response) {
  try {
    // only logged in users can submit a help complaint
    const auth_user = get_auth_user(request)
    if (!auth_user) {
      return response.status(401).json({ message: 'Unauthorized' })
    }

    // pull and trim the subject and message from request
    const subject_raw = request.body && request.body.subject ? request.body.subject : ''
    const message_raw = request.body && request.body.message ? request.body.message : ''

    const subject = String(subject_raw).trim()
    const message = String(message_raw).trim()

    // both fields are required for a valid complaint
    if (!subject || !message) {
      return response.status(400).json({ message: 'Subject and message are required' })
    }

    // create a record that links to the current user
    const complaint = new Complaint({
      userEmail: auth_user.email,
      userId: auth_user.userId,
      subject,
      message,
      status: 'not addressed'
    })

    // save to database and notify support by email
    await complaint.save()
    await send_help_email({
      subject,
      message,
      userEmail: auth_user.email
    })

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
    // keep logs simple but useful
    const msg = error && error.message ? error.message : error
    console.error('Help complaint error:', msg)
    return response.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
