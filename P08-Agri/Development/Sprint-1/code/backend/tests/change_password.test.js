/* Lightweight integration-style tests for account/change-password route.
 * Mocks external deps: JWT, Redis, User model, email, audit logs.
 * Run with: node tests/change_password.test.js
 */

const path = require('path')
const Module = require('module')

// --- Mock state collectors ---
const auditEvents = []
const emailsSent = []
const redisStore = new Map()

// --- Mocks ---
const mockJwt = {
  verify(token, secret) {
    if (token === 'goodtoken') {
      return { userId: 'u1', email: 'u@example.com', role: 'farmer' }
    }
    throw new Error('invalid token')
  }
}

function makeUser() {
  return {
    _id: 'u1',
    email: 'u@example.com',
    password: '',
    comparePassword: async function (candidate) {
      return candidate === 'GoodOld1!'
    },
    save: async function () {
      // Simulate reuse rejection when new password equals "Reuse1!A"
      if (this.password === 'Reuse1!A') {
        const err = new Error('reuse')
        err.code = 'PASSWORD_REUSE'
        throw err
      }
      return
    }
  }
}

const mockUserModel = {
  async findById(id) {
    if (id === 'u1') {
      return makeUser()
    }
    return null
  }
}

const mockSecurityEvent = {
  async create(doc) {
    auditEvents.push(doc)
    return
  }
}

const mockEmailService = {
  async send_password_change_email(to) {
    emailsSent.push(to)
    return
  }
}

const mockRedisClient = {
  async incr(key) {
    const v = Number(redisStore.get(key) || 0) + 1
    redisStore.set(key, v)
    return v
  },
  async expire(key, _seconds) {
    // no-op for this test harness
    return
  },
  async get(key) {
    return redisStore.get(key) || null
  },
  async set(key, value, opts) {
    redisStore.set(key, value)
    return
  },
  async del(key) {
    redisStore.delete(key)
    return
  }
}

// --- Monkey-patch require to inject mocks before loading router ---
const originalRequire = Module.prototype.require
Module.prototype.require = function (id) {
  if (id === 'jsonwebtoken') return mockJwt
  // Absolute paths to local modules being required by account.js
  try {
    const resolved = Module._resolveFilename(id, this)
    if (resolved.endsWith(path.join('backend', 'models', 'User.js'))) return mockUserModel
    if (resolved.endsWith(path.join('backend', 'models', 'SecurityEvent.js'))) return mockSecurityEvent
    if (resolved.endsWith(path.join('backend', 'redis_client.js'))) return { redis_client: mockRedisClient }
    if (resolved.endsWith(path.join('backend', 'email_service.js'))) return mockEmailService
  } catch {}
  return originalRequire.apply(this, arguments)
}

// Load the router under test
const accountRouter = require('../routes/account')

// Helper: find the change-password POST handler from the router
function getChangePasswordHandler(router) {
  const stack = router && router.stack ? router.stack : []
  for (const layer of stack) {
    if (layer && layer.route && layer.route.path === '/change-password') {
      const routeStack = layer.route.stack || []
      for (const r of routeStack) {
        if (r.method === 'post' && typeof r.handle === 'function') {
          return r.handle
        }
      }
    }
  }
  throw new Error('change-password handler not found')
}

// Express middleware: router.use(require_https) wraps before handler
// We'll also extract the first middleware to test HTTPS enforcement.
function getFirstMiddleware(router) {
  const stack = router && router.stack ? router.stack : []
  // First layer is likely the require_https middleware
  for (const layer of stack) {
    if (!layer.route && typeof layer.handle === 'function') {
      return layer.handle
    }
  }
  throw new Error('require_https middleware not found')
}

const handler = getChangePasswordHandler(accountRouter)
const requireHttpsMw = getFirstMiddleware(accountRouter)

function makeReqRes({ secure = false, xfp = '', auth = '', body = {}, ip = '1.2.3.4' } = {}) {
  const headers = {}
  if (xfp) headers['x-forwarded-proto'] = xfp
  if (auth) headers['authorization'] = auth
  const req = {
    headers,
    body,
    secure,
    ip,
    method: 'POST',
    url: '/api/account/change-password'
  }
  const res = {
    _status: 200,
    _json: null,
    status(code) {
      this._status = code
      return this
    },
    json(payload) {
      this._json = payload
      return this
    }
  }
  return { req, res }
}

async function runTest(name, fn) {
  try {
    await fn()
    console.log('OK:', name)
  } catch (e) {
    console.error('FAIL:', name, '-', e && e.message ? e.message : e)
    process.exitCode = 1
  }
}

async function main() {
  console.log('Starting change-password tests...')
  console.log('Router stack size:', (accountRouter && accountRouter.stack && accountRouter.stack.length) || 0)
  console.log('Handler found:', typeof handler === 'function')
  process.env.NODE_ENV = 'production'

  await runTest('HTTPS enforced (non-https blocked)', async () => {
    const { req, res } = makeReqRes({ secure: false, xfp: '', auth: '' })
    requireHttpsMw(req, res, function next() {
      throw new Error('next() should not be called for non-HTTPS')
    })
    if (res._status !== 403) throw new Error('Expected 403 when not HTTPS')
  })

  await runTest('Unauthorized without token', async () => {
    const { req, res } = makeReqRes({ secure: true, xfp: 'https' })
    requireHttpsMw(req, res, function next() {})
    await handler(req, res)
    if (res._status !== 401) throw new Error('Expected 401 without Authorization')
  })

  await runTest('Weak password rejected by policy', async () => {
    const { req, res } = makeReqRes({
      secure: true,
      xfp: 'https',
      auth: 'Bearer goodtoken',
      body: { oldPassword: 'GoodOld1!', newPassword: 'weak' }
    })
    requireHttpsMw(req, res, function next() {})
    await handler(req, res)
    if (res._status !== 400) throw new Error('Expected 400 for weak password')
    if (!/must be at least|upper|lower|number|special/i.test(res._json.message)) {
      throw new Error('Expected complexity message')
    }
  })

  await runTest('Wrong old password rejected', async () => {
    const { req, res } = makeReqRes({
      secure: true,
      xfp: 'https',
      auth: 'Bearer goodtoken',
      body: { oldPassword: 'BadOld1!', newPassword: 'Stronger1!A' }
    })
    requireHttpsMw(req, res, function next() {})
    await handler(req, res)
    if (res._status !== 400) throw new Error('Expected 400 for wrong old password')
    if (!/Old password is incorrect/.test(res._json.message)) {
      throw new Error('Expected incorrect old password message')
    }
  })

  await runTest('Successful password change sends email and logs', async () => {
    const { req, res } = makeReqRes({
      secure: true,
      xfp: 'https',
      auth: 'Bearer goodtoken',
      body: { oldPassword: 'GoodOld1!', newPassword: 'Stronger1!A' }
    })
    requireHttpsMw(req, res, function next() {})
    await handler(req, res)
    if (res._status !== 200) throw new Error('Expected 200 on success')
    if (!emailsSent.includes('u@example.com')) throw new Error('Confirmation email not sent')
    if (!auditEvents.some(e => e.type === 'password_change_success')) {
      throw new Error('Success audit not logged')
    }
  })

  await runTest('Password reuse blocked', async () => {
    const { req, res } = makeReqRes({
      secure: true,
      xfp: 'https',
      auth: 'Bearer goodtoken',
      body: { oldPassword: 'GoodOld1!', newPassword: 'Reuse1!A' }
    })
    requireHttpsMw(req, res, function next() {})
    await handler(req, res)
    if (res._status !== 400) throw new Error('Expected 400 for password reuse')
  })

  await runTest('Temporary lockout after repeated failures', async () => {
    // Clear counters
    redisStore.clear()
    // 5 failures
    for (let i = 0; i < 5; i++) {
      const { req, res } = makeReqRes({
        secure: true,
        xfp: 'https',
        auth: 'Bearer goodtoken',
        body: { oldPassword: 'BadOld1!', newPassword: 'Stronger1!A' }
      })
      requireHttpsMw(req, res, function next() {})
      await handler(req, res)
    }
    // Now should be locked
    const { req, res } = makeReqRes({
      secure: true,
      xfp: 'https',
      auth: 'Bearer goodtoken',
      body: { oldPassword: 'GoodOld1!', newPassword: 'Stronger1!A' }
    })
    requireHttpsMw(req, res, function next() {})
    await handler(req, res)
    if (res._status !== 429) throw new Error('Expected 429 during lockout')
  })
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})


