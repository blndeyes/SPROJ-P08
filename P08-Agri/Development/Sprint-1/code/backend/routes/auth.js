const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { redis_client } = require('../redis_client')
const { generate_otp, hash_otp } = require('../otp_utils')
const { send_otp_email } = require('../email_service')

// Step 1 of signup: create a pending signup and email an OTP
router.post('/register-otp', async function (req, res) {
  try {
    const { name, email, phone, password, role } = req.body

    if (!name || !email || !password) { // Basic required fields
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const existing_user = await User.findOne({ email })
    if (existing_user) {
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    const otp = generate_otp() // Create a short code like 123456
    const otp_hash = hash_otp(otp) // Store only the hash (never the raw OTP)

    const pending_signup = {
      name,
      email: email.toLowerCase(),
      phone: phone || '',
      password,
      role: role || 'farmer',
      otp_hash, // Will be compared against hash of user input
      attempts: 0,
      created_at: Date.now()
    }

    const redis_key = 'signup:' + pending_signup.email // Namespace by email
    await redis_client.set(redis_key, JSON.stringify(pending_signup), { EX: 600 }) // 10 min expiry

    await send_otp_email(pending_signup.email, otp) // Send OTP to user's email

    return res.status(200).json({ message: 'OTP sent to email for verification' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Step 2 of signup: verify OTP and create the user
router.post('/verify-otp', async function (req, res) {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' })
    }

    const normalized_email = email.toLowerCase() // Match the key used earlier
    const redis_key = 'signup:' + normalized_email
    const pending_json = await redis_client.get(redis_key) // Look up pending signup

    if (!pending_json) {
      return res.status(400).json({ message: 'OTP expired or not found. Please sign up again.' })
    }

    const pending = JSON.parse(pending_json)

    if (pending.attempts >= 5) { // no brute force attempts
      await redis_client.del(redis_key)
      return res.status(400).json({ message: 'Too many incorrect attempts. Please sign up again.' })
    }

    const input_hash = hash_otp(otp) // Compare hashes (not raw OTP)
    if (input_hash !== pending.otp_hash) {
      pending.attempts = pending.attempts + 1
      await redis_client.set(redis_key, JSON.stringify(pending), { EX: 600 }) // Keep it alive for retry
      return res.status(400).json({ message: 'Invalid OTP' })
    }

    const existing_user = await User.findOne({ email: normalized_email })
    if (existing_user) {
      await redis_client.del(redis_key)
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    const user = new User({
      name: pending.name,
      email: pending.email,
      phone: pending.phone,
      password: pending.password,
      role: pending.role,
      emailVerified: true // Mark email as verified on creation
    })

    await user.save() // Password is hashed by the User model pre save hook
    await redis_client.del(redis_key) // Clear the pending signup

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role }, // Minimal user info
      process.env.JWT_SECRET, // Server-side secret
      { expiresIn: '7d' } // 7 day session
    )

    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Simple register (without OTP): kept for compatibility
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' })
    }

    const user = new User({
      name,
      email,
      phone,
      password,
      role
    })

    await user.save() // Password hashing handled by the model

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await user.comparePassword(password) // bcrypt compare against stored hash
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
