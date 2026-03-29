const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const Complaint = require('../models/Complaint')
const User = require('../models/User')
const PasswordHistory = require('../models/PasswordHistory')
const {
  send_admin_broadcast_email,
  send_complaint_response_email,
  send_admin_password_reset_email
} = require('../email_service')

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

function get_auth_user(request) {
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) {
    return null
  }
  const token = auth_header.slice(7)
  if (!token) {
    return null
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return payload
  } catch (error) {
    console.error('[Admin][jwt-verify-error]', error.message || error)
    return null
  }
}

function require_admin(request, response) {
  const auth_user = get_auth_user(request)
  if (!auth_user) {
    response.status(401).json({ message: 'Unauthorized' })
    return null
  }

  const role = auth_user.role || auth_user.userRole
  if (role !== 'admin') {
    response.status(403).json({ message: 'Forbidden' })
    return null
  }

  return auth_user
}

function validate_password_strength(password) {
  if (typeof password !== 'string') {
    return 'Password is required'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number'
  }
  return null
}

function generate_temporary_password() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(12)
  let result = ''
  for (let i = 0; i < bytes.length; i += 1) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

router.get('/complaints', async function (request, response) {
  try {
    const auth_user = require_admin(request, response)
    if (!auth_user) {
      return
    }

    const status = request.query.status
    let limit = Number.parseInt(request.query.limit, 10) || 50
    if (Number.isNaN(limit) || limit <= 0) {
      limit = 50
    }
    if (limit > 100) {
      limit = 100
    }

    let skip = Number.parseInt(request.query.skip, 10) || 0
    if (Number.isNaN(skip) || skip < 0) {
      skip = 0
    }

    const query = {}
    if (status === 'addressed' || status === 'not addressed') {
      query.status = status
    }

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await Complaint.countDocuments(query)

    response.json({
      complaints,
      total,
      limit,
      skip
    })
  } catch (error) {
    console.error('[Admin] Failed to fetch complaints:', error.message || error)
    response.status(500).json({ message: 'Failed to fetch complaints' })
  }
})

router.patch('/complaints/:id', async function (request, response) {
  try {
    const auth_user = require_admin(request, response)
    if (!auth_user) {
      return
    }

    const raw_id = request.params.id
    if (!raw_id || !mongoose.Types.ObjectId.isValid(raw_id)) {
      response.status(400).json({ message: 'Invalid complaint id' })
      return
    }

    const status = request.body?.status
    if (!status || (status !== 'addressed' && status !== 'not addressed')) {
      response.status(400).json({ message: 'Invalid status value' })
      return
    }

    const updated = await Complaint.findByIdAndUpdate(
      raw_id,
      { status },
      { new: true }
    ).lean()

    if (!updated) {
      response.status(404).json({ message: 'Complaint not found' })
      return
    }

    response.json({ complaint: updated })
  } catch (error) {
    console.error('[Admin] Failed to update complaint:', error.message || error)
    response.status(500).json({ message: 'Failed to update complaint' })
  }
})

router.post('/complaints/:id/respond', async function (request, response) {
  try {
    const auth_user = require_admin(request, response)
    if (!auth_user) {
      return
    }

    const raw_id = request.params.id
    if (!raw_id || !mongoose.Types.ObjectId.isValid(raw_id)) {
      response.status(400).json({ message: 'Invalid complaint id' })
      return
    }

    const response_text = String(request.body?.response || '').trim()
    if (!response_text) {
      response.status(400).json({ message: 'Response is required' })
      return
    }

    if (response_text.length > 4000) {
      response.status(400).json({ message: 'Response exceeds 4000 characters' })
      return
    }

    const complaint = await Complaint.findById(raw_id)
    if (!complaint) {
      response.status(404).json({ message: 'Complaint not found' })
      return
    }

    complaint.response = response_text
    complaint.responded_at = new Date()
    complaint.responded_by = auth_user.sub || auth_user.userId || auth_user.id || null
    complaint.status = 'addressed'
    await complaint.save()

    try {
      await send_complaint_response_email({
        recipient_email: complaint.userEmail,
        subject: complaint.subject,
        response: response_text,
        original_message: complaint.message
      })
    } catch (email_error) {
      console.error('[Admin] Failed to send complaint response:', email_error?.message || email_error)
    }

    response.json({ complaint })
  } catch (error) {
    console.error('[Admin] Failed to respond to complaint:', error.message || error)
    response.status(500).json({ message: 'Failed to respond to complaint' })
  }
})

router.post('/users/reset-password', async function (request, response) {
  try {
    const auth_user = require_admin(request, response)
    if (!auth_user) {
      return
    }

    const email = String(request.body?.email || '').trim().toLowerCase()
    let new_password = String(request.body?.newPassword || '').trim()

    if (!email) {
      return response.status(400).json({ message: 'Email is required' })
    }

    const user = await User.findOne({ email, role: 'farmer' })
    if (!user) {
      return response.status(404).json({ message: 'Farmer not found' })
    }

    if (!new_password) {
      new_password = generate_temporary_password()
    }

    const password_error = validate_password_strength(new_password)
    if (password_error) {
      return response.status(400).json({ message: password_error })
    }

    const previous_hash = user.password_hash || user.password || null
    if (previous_hash) {
      const history_entry = new PasswordHistory({
        userId: user._id,
        passwordHash: previous_hash,
        createdAt: new Date()
      })
      await history_entry.save()
    }

    const new_hash = await bcrypt.hash(new_password, 10)
    user.password_hash = new_hash
    user.password = undefined
    user.failed_login_attempts = 0
    user.lock_until = null
    await user.save()

    try {
      await send_admin_password_reset_email({
        recipient_email: user.email,
        new_password: new_password
      })
    } catch (email_error) {
      console.error('[Admin] Failed to send password reset email:', email_error?.message || email_error)
    }

    return response.json({ ok: true, message: 'Password updated', email: user.email })
  } catch (error) {
    console.error('[Admin] Failed to reset farmer password:', error.message || error)
    return response.status(500).json({ message: 'Failed to reset password' })
  }
})

router.post('/email', async function (request, response) {
  try {
    const auth_user = require_admin(request, response)
    if (!auth_user) {
      return
    }

    const subject = String(request.body?.subject || '').trim()
    const message = String(request.body?.message || '').trim()
    const mode = String(request.body?.mode || 'all')
    const recipients = Array.isArray(request.body?.recipients)
      ? request.body.recipients
      : []

    if (!subject || !message) {
      response.status(400).json({ message: 'Subject and message are required' })
      return
    }

    if (subject.length > 200) {
      response.status(400).json({ message: 'Subject exceeds 200 characters' })
      return
    }

    if (message.length > 4000) {
      response.status(400).json({ message: 'Message exceeds 4000 characters' })
      return
    }

    let emails = []

    if (mode === 'all') {
      const users = await User.find({})
        .select('email')
        .lean()
      emails = users.map((u) => u.email).filter(Boolean)
    } else if (mode === 'specific') {
      emails = recipients
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)
    } else {
      response.status(400).json({ message: 'Invalid mode. Use "all" or "specific"' })
      return
    }

    if (emails.length > 200) {
      response.status(400).json({ message: 'Too many recipients (max 200)' })
      return
    }

    if (emails.length === 0) {
      response.status(400).json({ message: 'No recipient emails found' })
      return
    }

    const results = []
    let sent = 0
    let failed = 0

    for (const email of emails) {
      try {
        await send_admin_broadcast_email({ recipient_email: email, subject, message })
        sent += 1
        results.push({ email, ok: true })
      } catch (error) {
        failed += 1
        results.push({ email, ok: false, error: error?.message || String(error) })
      }
    }

    response.json({
      ok: failed === 0,
      sent,
      failed,
      results
    })
  } catch (error) {
    console.error('[Admin] Failed to send emails:', error.message || error)
    response.status(500).json({ message: 'Failed to send emails' })
  }
})

module.exports = router
