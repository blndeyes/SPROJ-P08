const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const SecurityEvent = require('../models/SecurityEvent')
const { redis_client } = require('../redis_client')
const { send_password_change_email } = require('../email_service')

const router = express.Router()

function get_auth_user(request) {
  // verify bearer token to authenticate the user
  const auth_header = request.headers.authorization || ''
  if (!auth_header.startsWith('Bearer ')) {
    return null
  }
  const token = auth_header.slice(7)
  if (!token) {
    return null
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return payload
  } catch (error) {
    return null
  }
}

function get_client_ip(request) {
  const xff = request.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    // First IP in the list
    return xff.split(',')[0].trim()
  }
  return request.ip || ''
}

function require_https(request, response, next) {
  const is_prod = process.env.NODE_ENV === 'production'
  if (!is_prod) {
    next()
    return
  }
  const proto = (request.headers['x-forwarded-proto'] || '').toString().toLowerCase()
  const is_secure = request.secure === true || proto === 'https'
  if (!is_secure) {
    return response.status(403).json({ message: 'HTTPS is required' })
  }
  next()
}

function check_password_strength(password) {
  if (typeof password !== 'string') {
    return { ok: false, message: 'New password is invalid' }
  }
  // Enforce stronger policy: length >= 10, at least 1 upper, 1 lower, 1 digit, 1 special
  const minLen = 10
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  if (password.length < minLen) {
    return { ok: false, message: 'New password must be at least 10 characters long' }
  }
  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return {
      ok: false,
      message: 'New password must include upper, lower, number, and special character'
    }
  }
  return { ok: true }
}

async function is_rate_limited(user_id, ip) {
  try {
    const userKey = 'rl:cpw:user:' + user_id
    const ipKey = ip ? 'rl:cpw:ip:' + ip : null
    // 10-minute window
    const windowSeconds = 10 * 60
    const maxUserRequests = 10
    const maxIpRequests = 30

    const results = []
    const incrUser = await redis_client.incr(userKey)
    results.push(incrUser)
    if (incrUser === 1) {
      await redis_client.expire(userKey, windowSeconds)
    }
    let ipLimited = false
    if (ipKey) {
      const incrIp = await redis_client.incr(ipKey)
      if (incrIp === 1) {
        await redis_client.expire(ipKey, windowSeconds)
      }
      ipLimited = incrIp > maxIpRequests
    }
    const userLimited = incrUser > maxUserRequests
    return userLimited || ipLimited
  } catch (e) {
    // On Redis errors, fail open for rate limiting (do not block)
    return false
  }
}

async function is_locked(user_id) {
  try {
    const key = 'lock:cpw:user:' + user_id
    const v = await redis_client.get(key)
    return Boolean(v)
  } catch {
    return false
  }
}

async function register_failure(user_id) {
  try {
    const failKey = 'fail:cpw:user:' + user_id
    const lockKey = 'lock:cpw:user:' + user_id
    const n = await redis_client.incr(failKey)
    if (n === 1) {
      // Track failures for 15 minutes
      await redis_client.expire(failKey, 15 * 60)
    }
    if (n >= 5) {
      // Lock user for 15 minutes
      await redis_client.set(lockKey, '1', { EX: 15 * 60 })
    }
  } catch {}
}

async function clear_failures(user_id) {
  try {
    await redis_client.del('fail:cpw:user:' + user_id)
    await redis_client.del('lock:cpw:user:' + user_id)
  } catch {}
}

router.use(require_https)

router.post('/change-password', async function (request, response) {
  try {
    // must be logged in to change a password
    const auth_user = get_auth_user(request)
    if (!auth_user) {
      return response.status(401).json({ message: 'Unauthorized' })
    }

    // Check temporary lockout
    const locked = await is_locked(auth_user.userId)
    if (locked) {
      return response.status(429).json({ message: 'Too many attempts. Try again later.' })
    }

    // Simple rate limit
    const ip = get_client_ip(request)
    const limited = await is_rate_limited(auth_user.userId, ip)
    if (limited) {
      return response.status(429).json({ message: 'Too many requests. Please slow down.' })
    }

    // extract both old and new password values
    const old_password_raw = request.body && request.body.oldPassword ? request.body.oldPassword : ''
    const new_password_raw = request.body && request.body.newPassword ? request.body.newPassword : ''

    const old_password = String(old_password_raw)
    const new_password = String(new_password_raw)

    // validate required fields
    if (!old_password || !new_password) {
      return response.status(400).json({ message: 'Old password and new password are required' })
    }

    // Strong password policy
    const strength = check_password_strength(new_password)
    if (!strength.ok) {
      await register_failure(auth_user.userId)
      return response.status(400).json({ message: strength.message })
    }

    // find the current user document
    const user = await User.findById(auth_user.userId)
    if (!user) {
      return response.status(404).json({ message: 'User not found' })
    }

    // verify the old password matches
    const is_match = await user.comparePassword(old_password)
    if (!is_match) {
      // Log failure and register strike
      try {
        await SecurityEvent.create({
          userId: auth_user.userId,
          type: 'password_change_failure',
          ip,
          userAgent: request.headers['user-agent'] || '',
          success: false,
          meta: { reason: 'old_password_incorrect' }
        })
      } catch {}
      await register_failure(auth_user.userId)
      return response.status(400).json({ message: 'Old password is incorrect' })
    }

    // Log attempt
    try {
      await SecurityEvent.create({
        userId: auth_user.userId,
        type: 'password_change_attempt',
        ip,
        userAgent: request.headers['user-agent'] || '',
        success: true
      })
    } catch {}

    // set and save the new password, hashing is handled by the model hook
    user.password = new_password
    try {
      await user.save()
    } catch (e) {
      // Handle password reuse error thrown by model
      const code = e && e.code ? e.code : null
      if (code === 'PASSWORD_REUSE') {
        await register_failure(auth_user.userId)
        return response.status(400).json({ message: 'New password must not match a recent password' })
      }
      throw e
    }

    // Clear failure counters/lock on success
    await clear_failures(auth_user.userId)

    // Log success
    try {
      await SecurityEvent.create({
        userId: auth_user.userId,
        type: 'password_change_success',
        ip,
        userAgent: request.headers['user-agent'] || '',
        success: true
      })
    } catch {}

    // Send confirmation email (best-effort)
    try {
      if (user && user.email) {
        await send_password_change_email(user.email)
      }
    } catch (e) {
      // Log only a concise error to help operators debug SMTP issues
      const emsg = e && e.message ? e.message : e
      console.error('Password change email failed:', emsg)
    }

    return response.json({ message: 'Password changed successfully' })
  } catch (error) {
    // log a concise error for troubleshooting
    const msg = error && error.message ? error.message : error
    console.error('Change password error:', msg)
    return response.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
