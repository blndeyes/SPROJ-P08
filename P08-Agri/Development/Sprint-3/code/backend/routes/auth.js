const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const rateLimit = require('express-rate-limit')
const { OAuth2Client } = require('google-auth-library')
const { Resend } = require('resend')
const User = require('../models/User')
const AdminSeed = require('../models/AdminSeed')
const LoginAttempt = require('../models/LoginAttempt')

const router = express.Router()

// STRIDE Denial of service: rate limit Google auth endpoint
const GOOGLE_AUTH_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const GOOGLE_AUTH_MAX_PER_WINDOW = 15
const google_auth_limiter = rateLimit({
  windowMs: GOOGLE_AUTH_WINDOW_MS,
  max: GOOGLE_AUTH_MAX_PER_WINDOW,
  message: { message: 'Too many Google sign-in attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})

// STRIDE Repudiation: log Google sign-in attempt (never log id_token)
async function log_google_attempt(request, email, userId, success, reason) {
  try {
    const safeEmail = (email && String(email).trim()) ? String(email).toLowerCase().trim() : '(no-email)'
    await LoginAttempt.create({
      email: safeEmail,
      user_id: userId || undefined,
      ip_address: request.ip || request.connection?.remoteAddress,
      user_agent: request.get('user-agent') || undefined,
      success,
      reason: reason || undefined,
      method: 'google'
    })
  } catch (err) {
    console.error('[Auth] Failed to log Google attempt:', err.message || err)
  }
}

let resend_client = null

function get_resend_client() {
  if (resend_client) {
    return resend_client
  }

  if (!process.env.RESEND_API_KEY) {
    return null
  }

  resend_client = new Resend(process.env.RESEND_API_KEY)
  return resend_client
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h'
const LOGIN_MAX_FAILED_ATTEMPTS = Number.parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS || '5', 10)
const LOGIN_LOCKOUT_MINUTES = Number.parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10)
const ALLOWED_ROLES = ['farmer', 'inspector']

function normalize_role(role) {
  const value = String(role || '').trim().toLowerCase()
  if (ALLOWED_ROLES.includes(value)) {
    return value
  }
  return 'farmer'
}

async function sendOtpEmail(email, otp) {
  console.log('[Auth] Generated OTP for', email, '=>', otp)

  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Auth] RESEND_API_KEY not set; OTP will not be emailed in production.')
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'

  const text_message = `Your verification code is: ${otp}\n\nIt will expire in 10 minutes.`

  const html_message = `<p>Your verification code is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Auth] RESEND_API_KEY not set; OTP will not be emailed in production.')
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const result = await client.emails.send({
    from: from_email,
    to: [email],
    subject: 'Your AgriQual verification code',
    text: text_message,
    html: html_message
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('[Auth] Resend email id:', result.id)
  }

  console.log('[Auth] OTP email sent to', email)
}

function normalizeEmail(email) {
  if (!email) {
    return ''
  }
  return String(email).trim().toLowerCase()
}

function validateEmail(email) {
  const value = normalizeEmail(email)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(value)
}

function validatePasswordStrength(password) {
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

function createTokenForUser(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role || 'farmer'
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

  return token
}

function getLockoutSeconds(lockUntil) {
  if (!lockUntil) {
    return 0
  }
  const now = Date.now()
  const diffMs = lockUntil.getTime() - now
  if (diffMs <= 0) {
    return 0
  }
  return Math.round(diffMs / 1000)
}

router.post('/register-otp', async function (request, response) {
  try {
    const { name, email, phone, password, role } = request.body || {}
    const safe_role = normalize_role(role)

    const normalizedEmail = normalizeEmail(email)

    if (!name || !String(name).trim()) {
      return response.status(400).json({ message: 'Name is required' })
    }

    if (!validateEmail(normalizedEmail)) {
      return response.status(400).json({ message: 'Valid email is required' })
    }

    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      return response.status(400).json({ message: passwordError })
    }

    let user = await User.findOne({ email: normalizedEmail })

    if (user && user.email_verified === true) {
      return response.status(400).json({ message: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (!user) {
      user = new User({
        name: String(name).trim(),
        email: normalizedEmail,
        phone: phone || null,
        role: safe_role,
        password_hash: passwordHash,
        email_verified: false
      })
    } else {
      user.name = String(name).trim()
      user.phone = phone || user.phone || null
      user.role = safe_role
      user.password_hash = passwordHash
      user.email_verified = false
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const otpHash = await bcrypt.hash(otp, 10)

    user.pending_otp_hash = otpHash
    user.pending_otp_expires_at = new Date(Date.now() + 10 * 60 * 1000)
    user.failed_login_attempts = 0
    user.lock_until = null

    await user.save()

    await sendOtpEmail(normalizedEmail, otp)

    const payload = {
      ok: true,
      message: 'Verification code has been sent to your email'
    }

    if (process.env.NODE_ENV !== 'production') {
      payload.debug_otp = otp
    }

    return response.json(payload)
  } catch (error) {
    const message = error && error.message ? error.message : error
    console.error('[Auth] /register-otp error:', message)
    return response.status(502).json({ ok: false, message: 'Failed to send verification code' })
  }
})

router.post('/verify-otp', async function (request, response) {
  try {
    const { email, otp } = request.body || {}

    const normalizedEmail = normalizeEmail(email)
    const code = String(otp || '').trim()

    if (!validateEmail(normalizedEmail)) {
      return response.status(400).json({ message: 'Valid email is required' })
    }

    if (!code || code.length < 4) {
      return response.status(400).json({ message: 'OTP code is required' })
    }

    const user = await User.findOne({ email: normalizedEmail })

    if (!user || !user.pending_otp_hash || !user.pending_otp_expires_at) {
      return response.status(400).json({ message: 'Invalid or expired verification code' })
    }

    const now = new Date()
    if (user.pending_otp_expires_at <= now) {
      return response.status(400).json({ message: 'Verification code has expired' })
    }

    const isMatch = await bcrypt.compare(code, user.pending_otp_hash)
    if (isMatch !== true) {
      return response.status(400).json({ message: 'Invalid verification code' })
    }

    user.email_verified = true
    user.pending_otp_hash = undefined
    user.pending_otp_expires_at = undefined
    user.failed_login_attempts = 0
    user.lock_until = null

    await user.save()

    const token = createTokenForUser(user)

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'farmer'
    }

    return response.json({
      token,
      user: safeUser
    })
  } catch (error) {
    const message = error && error.message ? error.message : error
    console.error('[Auth] /verify-otp error:', message)
    return response.status(500).json({ message: 'OTP verification failed' })
  }
})

router.post('/login', async function (request, response) {
  try {
    const { email, password } = request.body || {}

    const normalizedEmail = normalizeEmail(email)

    if (!validateEmail(normalizedEmail)) {
      return response.status(400).json({ message: 'Valid email is required' })
    }

    if (!password || typeof password !== 'string') {
      return response.status(400).json({ message: 'Password is required' })
    }

    const user = await User.findOne({ email: normalizedEmail })

    const baseLog = {
      email: normalizedEmail,
      ip: request.ip,
      time: new Date().toISOString()
    }

    if (!user) {
      console.log('[Auth][login] failed (no such user):', baseLog)
      return response.status(401).json({ message: 'Invalid email or password' })
    }

    const now = new Date()

    if (user.lock_until && user.lock_until > now) {
      const secondsLeft = getLockoutSeconds(user.lock_until)
      console.log('[Auth][login] locked out:', {
        ...baseLog,
        lockedUntil: user.lock_until.toISOString(),
        secondsLeft
      })

      return response.status(429).json({
        message: 'Too many failed login attempts. Your account is temporarily locked.',
        retryAfterSeconds: secondsLeft
      })
    }

    const storedHash = user.password_hash || user.password
    if (!storedHash) {
      console.log('[Auth][login] failed (no password hash):', baseLog)
      return response.status(401).json({ message: 'Invalid email or password' })
    }

    const isMatch = await bcrypt.compare(password, storedHash)

    if (!isMatch) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1

      if (user.failed_login_attempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
        user.lock_until = new Date(now.getTime() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
      }

      await user.save()

      if (user.lock_until && user.lock_until > now) {
        const secondsLeft = getLockoutSeconds(user.lock_until)
        console.log('[Auth][login] account locked due to repeated failures:', {
          ...baseLog,
          failedAttempts: user.failed_login_attempts,
          lockUntil: user.lock_until.toISOString(),
          secondsLeft
        })

        return response.status(429).json({
          message: 'Too many failed login attempts. Your account is temporarily locked.',
          retryAfterSeconds: secondsLeft
        })
      }

      console.log('[Auth][login] failed (wrong password):', {
        ...baseLog,
        failedAttempts: user.failed_login_attempts
      })

      return response.status(401).json({ message: 'Invalid email or password' })
    }

    user.failed_login_attempts = 0
    user.lock_until = null
    await user.save()

    const token = createTokenForUser(user)

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'farmer'
    }

    console.log('[Auth][login] success:', baseLog)

    return response.json({
      token,
      user: safeUser
    })
  } catch (error) {
    const message = error && error.message ? error.message : error
    console.error('[Auth] /login error:', message)
    return response.status(500).json({ message: 'Login failed' })
  }
})

// Google Sign-In (farmers and inspectors only; admin cannot sign up via Google)
// STRIDE: rate limit applied (DoS), audit log (Repudiation), no token logging (Info disclosure)
router.post('/google', google_auth_limiter, async function (request, response) {
  try {
    const { id_token: idToken, role: requestedRole } = request.body || {}

    // STRIDE Elevation of privilege: reject any attempt to supply admin role via Google
    const roleLower = String(requestedRole || '').trim().toLowerCase()
    if (roleLower === 'admin') {
      await log_google_attempt(request, '', null, false, 'role_admin_rejected')
      return response.status(403).json({ message: 'Admin role is not allowed via Google sign-in' })
    }

    if (!idToken || typeof idToken !== 'string') {
      return response.status(400).json({ message: 'Google ID token is required' })
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID
    if (!googleClientId) {
      console.error('[Auth] GOOGLE_CLIENT_ID is not set')
      return response.status(503).json({ message: 'Google sign-in is not configured' })
    }

    const client = new OAuth2Client(googleClientId)
    let ticket
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken.trim(),
        audience: googleClientId
      })
    } catch (verifyErr) {
      const msg = verifyErr && verifyErr.message ? verifyErr.message : 'Invalid token'
      console.error('[Auth] Google token verification failed:', msg)
      await log_google_attempt(request, '', null, false, 'invalid_token')
      return response.status(401).json({ message: 'Invalid Google sign-in. Please try again.' })
    }

    const payload = ticket.getPayload()
    const googleId = payload.sub
    const email = normalizeEmail(payload.email)
    const name = (payload.name || payload.given_name || payload.email || 'User').trim()

    if (!email) {
      await log_google_attempt(request, '', null, false, 'missing_email')
      return response.status(400).json({ message: 'Google account email is required' })
    }

    let user = await User.findOne({ google_id: googleId })
    if (!user) {
      user = await User.findOne({ email })
    }

    if (user) {
      if (user.role === 'admin') {
        await log_google_attempt(request, email, null, false, 'admin_cannot_use_google')
        return response.status(403).json({ message: 'Admin accounts cannot sign in with Google' })
      }
      if (!user.google_id) {
        user.google_id = googleId
        user.name = name || user.name
        user.email_verified = true
        user.failed_login_attempts = 0
        user.lock_until = null
        user.pending_otp_hash = undefined
        user.pending_otp_expires_at = undefined
        await user.save()
      }
    } else {
      const safe_role = normalize_role(requestedRole)
      user = new User({
        name: name || 'User',
        email,
        role: safe_role,
        google_id: googleId,
        email_verified: true,
        failed_login_attempts: 0,
        lock_until: null
      })
      await user.save()
    }

    const token = createTokenForUser(user)
    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'farmer'
    }

    await log_google_attempt(request, user.email, user._id, true, undefined)

    return response.json({
      token,
      user: safeUser
    })
  } catch (error) {
    const message = error && error.message ? error.message : error
    console.error('[Auth] /google error:', message)
    await log_google_attempt(request, '', null, false, 'server_error').catch(() => {})
    return response.status(500).json({ message: 'Google sign-in failed' })
  }
})

router.post('/register', async function (request, response) {
  try {
    const { name, email, phone, password, role } = request.body || {}
    const safe_role = normalize_role(role)

    const normalizedEmail = normalizeEmail(email)

    if (!name || !String(name).trim()) {
      return response.status(400).json({ message: 'Name is required' })
    }

    if (!validateEmail(normalizedEmail)) {
      return response.status(400).json({ message: 'Valid email is required' })
    }

    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      return response.status(400).json({ message: passwordError })
    }

    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) {
      return response.status(400).json({ message: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: phone || null,
      role: safe_role,
      password_hash: passwordHash,
      email_verified: true,
      failed_login_attempts: 0,
      lock_until: null
    })

    await user.save()

    const token = createTokenForUser(user)

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'farmer'
    }

    return response.json({
      token,
      user: safeUser
    })
  } catch (error) {
    const message = error && error.message ? error.message : error
    console.error('[Auth] /register error:', message)
    return response.status(500).json({ message: 'Registration failed' })
  }
})

router.post('/seed-admin', async function (request, response) {
  try {
    const { email, password, name, code } = request.body || {}

    const seed_code = String(process.env.ADMIN_SEED_CODE || '').trim()
    if (!seed_code) {
      return response.status(501).json({ message: 'Admin seeding not configured' })
    }

    if (String(code || '').trim() !== seed_code) {
      return response.status(403).json({ message: 'Invalid seed code' })
    }

    const existing_admin = await User.findOne({ role: 'admin' })
    if (existing_admin) {
      return response.status(409).json({ message: 'Admin already exists' })
    }

    const seed_state = await AdminSeed.findOne({})
    if (seed_state && seed_state.usedAt) {
      return response.status(409).json({ message: 'Seed code already used' })
    }

    const normalizedEmail = normalizeEmail(email)
    if (!validateEmail(normalizedEmail)) {
      return response.status(400).json({ message: 'Valid email is required' })
    }

    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      return response.status(400).json({ message: passwordError })
    }

    const existing_email = await User.findOne({ email: normalizedEmail })
    if (existing_email) {
      return response.status(400).json({ message: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const admin_user = new User({
      name: String(name || 'Admin').trim() || 'Admin',
      email: normalizedEmail,
      phone: null,
      role: 'admin',
      password_hash: passwordHash,
      email_verified: true,
      failed_login_attempts: 0,
      lock_until: null
    })

    await admin_user.save()

    const seed_doc =
      seed_state ||
      new AdminSeed({
        usedAt: null,
        createdAdminId: null
      })

    seed_doc.usedAt = new Date()
    seed_doc.createdAdminId = admin_user._id
    await seed_doc.save()

    return response.status(201).json({
      ok: true,
      message: 'Admin account created',
      adminId: admin_user._id.toString()
    })
  } catch (error) {
    const message = error?.message || error
    console.error('[Auth] /seed-admin error:', message)
    return response.status(500).json({ message: 'Failed to seed admin account' })
  }
})

router.post('/seed-admin-reset', async function (request, response) {
  try {
    const { email, password, name, code } = request.body || {}

    const seed_code = String(process.env.ADMIN_SEED_CODE || '').trim()
    if (!seed_code) {
      return response.status(501).json({ message: 'Admin seeding not configured' })
    }

    if (String(code || '').trim() !== seed_code) {
      return response.status(403).json({ message: 'Invalid seed code' })
    }

    const normalizedEmail = normalizeEmail(email)
    if (!validateEmail(normalizedEmail)) {
      return response.status(400).json({ message: 'Valid email is required' })
    }

    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      return response.status(400).json({ message: passwordError })
    }

    await User.deleteMany({ role: 'admin' })
    await AdminSeed.deleteMany({})

    const passwordHash = await bcrypt.hash(password, 10)

    const admin_user = new User({
      name: String(name || 'Admin').trim() || 'Admin',
      email: normalizedEmail,
      phone: null,
      role: 'admin',
      password_hash: passwordHash,
      email_verified: true,
      failed_login_attempts: 0,
      lock_until: null
    })

    await admin_user.save()

    const seed_doc = new AdminSeed({
      usedAt: new Date(),
      createdAdminId: admin_user._id
    })
    await seed_doc.save()

    return response.status(201).json({
      ok: true,
      message: 'Admin account reset',
      adminId: admin_user._id.toString()
    })
  } catch (error) {
    const message = error?.message || error
    console.error('[Auth] /seed-admin-reset error:', message)
    return response.status(500).json({ message: 'Failed to reset admin account' })
  }
})

module.exports = router
