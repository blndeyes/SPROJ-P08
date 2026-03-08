const express = require('express')
const Complaint = require('../models/Complaint')
const User = require('../models/User')
const { send_help_email } = require('../email_service')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==== Rate-limit configuration (per user+IP) ====
const HELP_WINDOW_SECONDS =
  Number(process.env.HELP_TICKET_WINDOW_SECONDS) || 3600 // 1 hour
const HELP_MAX_PER_WINDOW =
  Number(process.env.HELP_TICKET_MAX_PER_WINDOW) || 5

const help_rate_store = new Map()

function get_client_ip(request) {
  const xf = request.headers['x-forwarded-for']

  if (typeof xf === 'string' && xf.length > 0) {
    // "real-ip, proxy1, proxy2"
    return xf.split(',')[0].trim()
  }

  if (Array.isArray(xf) && xf.length > 0) {
    return String(xf[0]).trim()
  }

  // fallback: internal IP
  return request.ip || request.connection?.remoteAddress || 'unknown'
}

// ---- tiny text cleaner: trim, collapse spaces, cap length ----
function clean_text(value, max_len) {
  const str = typeof value === 'string' ? value : String(value || '')
  let trimmed = str.trim()
  trimmed = trimmed.replaceAll(/\s+/g, ' ')
  if (max_len && trimmed.length > max_len) {
    trimmed = trimmed.slice(0, max_len)
  }
  return trimmed
}

// ---- rate limit per user + client IP ----
function check_help_rate_limit(user_id, client_ip) {
  const now = Date.now()
  const window_ms = HELP_WINDOW_SECONDS * 1000
  const key = `${String(user_id)}|${String(client_ip || 'unknown')}`

  let entry = help_rate_store.get(key)
  if (!entry) {
    entry = { count: 0, windowStartMs: now }
    help_rate_store.set(key, entry)
  }

  const elapsed = now - entry.windowStartMs
  if (elapsed >= window_ms) {
    entry.count = 0
    entry.windowStartMs = now
  }

  entry.count += 1

  const remaining_ms = window_ms - (now - entry.windowStartMs)
  const retry_after_seconds = Math.max(1, Math.ceil(remaining_ms / 1000))

  console.log('[Help][rate-limit-check]', {
    key,
    count: entry.count,
    client_ip,
    window_start_iso: new Date(entry.windowStartMs).toISOString(),
    now_iso: new Date(now).toISOString()
  })

  if (entry.count > HELP_MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: retry_after_seconds
    }
  }

  return { allowed: true }
}

// ==== POST /api/help/complaints (any authenticated user) ====
router.post('/complaints', requireAuth, async function (request, response) {
  try {
    const user_id = request.auth.userId
    if (!user_id) {
      return response.status(401).json({ message: 'Unauthorized' })
    }

    // Look up the user in MongoDB to get email
    let user_email = ''
    try {
      const user_doc = await User.findById(user_id).select('email').lean()
      if (user_doc && user_doc.email) {
        user_email = String(user_doc.email).trim().toLowerCase()
      }
    } catch (db_error) {
      console.error('[Help][user-lookup-error]', db_error.message || db_error)
    }

    if (!user_email) {
      console.error('[Help][user-email-not-found]', { user_id })
      return response.status(401).json({ message: 'Unauthorized' })
    }

    // 4) Rate-limit for this user + client IP
    const client_ip = get_client_ip(request)
    const rate_result = check_help_rate_limit(user_id, client_ip)
    if (!rate_result.allowed) {
      return response.status(429).json({
        message:
          'You have reached the limit for help requests. Please try again later.',
        retryAfterSeconds: rate_result.retryAfterSeconds
      })
    }

    // 5) Validate + sanitize subject/message
    const subject_raw =
      request.body && request.body.subject ? request.body.subject : ''
    const message_raw =
      request.body && request.body.message ? request.body.message : ''

    const subject = clean_text(subject_raw, 200)
    const message = clean_text(message_raw, 4000)

    if (!subject && !message) {
      return response
        .status(400)
        .json({ message: 'Subject and message are required' })
    }

    if (!subject) {
      return response.status(400).json({ message: 'Subject is required' })
    }

    if (!message) {
      return response.status(400).json({ message: 'Message is required' })
    }

    // 6) Save complaint
    const complaint = new Complaint({
      userEmail: user_email,
      userId: user_id,
      subject,
      message,
      status: 'not addressed'
    })

    await complaint.save()

    // 7) Fire support email (best-effort)
    try {
      await send_help_email({
        subject,
        message,
        userEmail: user_email
      })
    } catch (email_error) {
      console.error('[Help] Failed to send help email:', email_error)
    }

    // 8) Success response
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
    console.error(
      'Help complaint error:',
      error && error.message ? error.message : error
    )
    return response.status(500).json({ message: 'Request failed' })
  }
})

module.exports = router
