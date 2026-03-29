require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()

const LOCAL_ORIGIN = 'http://localhost:3000'
const PROD_ORIGIN = 'https://sproj-p08-silk.vercel.app'
const VERCEL_PREVIEW_RE = /^https:\/\/[\w-]+\.vercel\.app$/

function is_allowed_origin(origin) {
  if (!origin) return true
  if (origin === LOCAL_ORIGIN) return true
  if (origin === PROD_ORIGIN) return true
  if (VERCEL_PREVIEW_RE.test(origin)) return true
  return false
}

const cors_options = {
  origin(origin, cb) {
    if (is_allowed_origin(origin)) return cb(null, true)
    return cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}
app.use(cors(cors_options))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (req, res) => res.json({ ok: true, cwd: process.cwd() }))
app.get('/api/health', (req, res) => res.json({ ok: true }))

const weather_router_path = path.resolve(__dirname, 'routes', 'weather.js')
const weather_exists = fs.existsSync(weather_router_path)
let weather_mounted = false
try {
  if (weather_exists) {
    const weather_router = require(weather_router_path)
    app.use('/api/weather', weather_router)
    weather_mounted = true
  }
} catch (e) {}

if (!weather_mounted) {
  app.get('/api/weather', (req, res) => {
    res.status(501).json({ ok: false, message: 'Weather router not mounted' })
  })
}

app.post('/api/auth/register', (req, res) => {
  const full_name = (req.body.full_name || req.body.name || '').trim()
  const email = (req.body.email || '').trim()
  const phone = (req.body.phone || '').trim()
  const role = (req.body.role || '').trim()
  const password = (req.body.password || '').trim()
  if (!full_name || !email || !password || !role) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }
  const user = { id: 'u_' + Date.now(), full_name, email, phone, role }
  const token = 'stub_token'
  res.status(201).json({ ok: true, user, token })
})

app.post('/api/auth/login', (req, res) => {
  const email = (req.body.email || '').trim()
  const password = (req.body.password || '').trim()
  if (!email || !password) {
    res.status(400).json({ error: 'Missing credentials' })
    return
  }
  const user = { id: 'u_' + Date.now(), email, role: 'farmer' }
  const token = 'stub_token'
  res.status(200).json({ ok: true, user, token })
})

const diagnose_router_path = path.resolve(__dirname, 'routes', 'diagnose.js')
let diagnose_mounted = false
try {
  const diagnose_router = require(diagnose_router_path)
  app.use('/api/diagnose', diagnose_router)
  diagnose_mounted = true
} catch (e) {}

app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS blocked: origin not allowed' })
    return
  }
  next(err)
})

const port = process.env.PORT || 5000
app.listen(port, () => {})
