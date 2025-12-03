/* Integration test for change-password route using:
 * - Express app mounting the real router
 * - In-memory MongoDB (mongodb-memory-server) with real Mongoose models
 * - Real jsonwebtoken signing/verification
 * - Mocked Redis client (same API used in router)
 * - Mocked email service to capture confirmation emails
 *
 * Run: node tests/change_password.integration.test.js
 */

const express = require('express')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Module = require('module')
const path = require('path')

// Capture sent emails and simple in-memory redis store
const sentEmails = []
const redisStore = new Map()

// Mock redis client used in router
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
  }
}

// Monkey-patch requires for redis_client and email_service only
const originalRequire = Module.prototype.require
Module.prototype.require = function (id) {
  try {
    const resolved = Module._resolveFilename(id, this)
    if (resolved.endsWith(path.join('backend', 'redis_client.js'))) {
      return { redis_client: mockRedisClient }
    }
    if (resolved.endsWith(path.join('backend', 'email_service.js'))) {
      return {
        send_password_change_email: async function (to) {
          sentEmails.push(to)
        }
      }
    }
  } catch {}
  return originalRequire.apply(this, arguments)
}

async function run() {
  console.log('Starting change_password.integration.test...')
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'testsecret'

  // Start in-memory MongoDB and connect mongoose
  const mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)

  // Load models (bind to current mongoose connection)
  const User = require('../models/User')
  const SecurityEvent = require('../models/SecurityEvent')

  // Seed a user with known old password (hash via pre-save)
  const seedUser = new User({
    name: 'Test User',
    email: 't@example.com',
    phone: '',
    password: 'GoodOld1!',
    role: 'farmer',
    emailVerified: true
  })
  await seedUser.save()

  // Build express app with router
  const accountRouter = require('../routes/account')
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use('/api/account', accountRouter)

  function authHeader(userId, email) {
    const token = jwt.sign({ userId, email, role: 'farmer' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    return 'Bearer ' + token
  }

  // HTTPS enforcement (no X-Forwarded-Proto => 403)
  {
    const res = await request(app)
      .post('/api/account/change-password')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'GoodOld1!', newPassword: 'Stronger1!A' })
    if (res.statusCode !== 403) throw new Error('Expected 403 without HTTPS header')
  }

  // Weak password rejected
  {
    const res = await request(app)
      .post('/api/account/change-password')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'GoodOld1!', newPassword: 'weak' })
    if (res.statusCode !== 400) throw new Error('Expected 400 for weak password')
  }

  // Wrong old password rejected
  {
    const res = await request(app)
      .post('/api/account/change-password')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'WrongOld1!', newPassword: 'Stronger1!A' })
    if (res.statusCode !== 400) throw new Error('Expected 400 for wrong old password')
  }

  // Successful change sends email and logs SecurityEvent
  sentEmails.length = 0
  redisStore.clear()
  {
    const res = await request(app)
      .post('/api/account/change-password')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'GoodOld1!', newPassword: 'Stronger1!A' })
    if (res.statusCode !== 200) throw new Error('Expected 200 on success')
    if (!sentEmails.includes('t@example.com')) throw new Error('Confirmation email not sent')
    const events = await SecurityEvent.find({ userId: seedUser._id, type: 'password_change_success' })
    if (!events || events.length === 0) throw new Error('Success SecurityEvent not recorded')
  }

  // Password reuse blocked (try to revert to old)
  {
    const res = await request(app)
      .post('/api/account/change-password')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'Stronger1!A', newPassword: 'GoodOld1!' })
    if (res.statusCode !== 400) throw new Error('Expected 400 for password reuse')
  }

  // Temporary lockout after repeated failures
  redisStore.clear()
  for (let i = 0; i < 5; i++) {
    await request(app)
      .post('/api/account/change-password')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'WrongOld1!', newPassword: 'Another1!A' })
  }
  {
    const res = await request(app)
      .post('/api/account/change-password')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', authHeader(seedUser._id.toString(), seedUser.email))
      .send({ oldPassword: 'Stronger1!A', newPassword: 'Another1!A' })
    if (res.statusCode !== 429) throw new Error('Expected 429 during lockout')
  }

  console.log('All integration tests passed.')

  await mongoose.disconnect()
  await mongoServer.stop()
}

run().catch((e) => {
  console.error('Integration test failed:', e && e.message ? e.message : e)
  process.exitCode = 1
})


