// Dev server that runs the real routers with in-memory MongoDB and mocked Redis/email.
// Usage: NODE_ENV=development node dev_server.js

const express = require('express')
const cors = require('cors')
const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const Module = require('module')
const path = require('path')

// Provide a JWT secret for signing/verification
process.env.JWT_SECRET = process.env.JWT_SECRET || 'devsecret'

// Simple in-memory Redis-like store for rate limiting and OTP cache in dev
const redisStore = new Map()
const mockRedisClient = {
  async incr(key) {
    const v = Number(redisStore.get(key) || 0) + 1
    redisStore.set(key, v)
    return v
  },
  async expire(key, _seconds) {
    return
  },
  async get(key) {
    return redisStore.get(key) || null
  },
  async set(key, val, opts) {
    redisStore.set(key, val)
    return
  },
  async del(key) {
    redisStore.delete(key)
    return
  },
  on() {}
}

// Mock email sends to console
const mockEmailService = {
  async send_otp_email(recipient_email, otp) {
    console.log('[DEV EMAIL] OTP for', recipient_email, 'is', otp)
  },
  async send_help_email(payload) {
    console.log('[DEV EMAIL] Help request to support:', payload)
  },
  async send_password_change_email(recipient_email) {
    console.log('[DEV EMAIL] Password change confirmation to', recipient_email)
  }
}

// Monkey-patch requires for redis_client and email_service only
const originalRequire = Module.prototype.require
Module.prototype.require = function (id) {
  try {
    const resolved = Module._resolveFilename(id, this)
    if (resolved.endsWith(path.join('backend', 'redis_client.js'))) {
      return { redis_client: mockRedisClient, connect_redis: async () => {} }
    }
    if (resolved.endsWith(path.join('backend', 'email_service.js'))) {
      return mockEmailService
    }
  } catch {}
  return originalRequire.apply(this, arguments)
}

async function main() {
  console.log('Starting dev server with in-memory MongoDB...')
  const mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)

  const app = express()
  app.set('trust proxy', 1)
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  app.get('/health', function (req, res) {
    res.json({ ok: true, env: process.env.NODE_ENV || 'development' })
  })
  app.get('/api/health', function (req, res) {
    res.json({ ok: true })
  })

  // Mount routers
  const auth_router = require('./routes/auth')
  const account_router = require('./routes/account')
  const weather_router = require('./routes/weather')
  const diagnose_router = require('./routes/diagnose')
  const help_router = require('./routes/help')
  const history_router = require('./routes/history')

  app.use('/api/auth', auth_router)
  app.use('/api/account', account_router)
  app.use('/api/weather', weather_router)
  app.use('/api/diagnose', diagnose_router)
  app.use('/api/help', help_router)
  app.use('/api/history', history_router)

  const port = process.env.PORT || 5000
  app.listen(port, function () {
    console.log('Dev backend listening on http://localhost:' + port)
  })
}

main().catch((e) => {
  console.error('Dev server failed:', e && e.message ? e.message : e)
  process.exit(1)
})


