const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const router = express.Router()

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
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return payload
  } catch (error) {
    return null
  }
}

router.post('/change-password', async function (request, response) {
  try {
    const auth_user = get_auth_user(request)
    if (!auth_user) {
      return response.status(401).json({ message: 'Unauthorized' })
    }

    const old_password_raw = request.body && request.body.oldPassword ? request.body.oldPassword : ''
    const new_password_raw = request.body && request.body.newPassword ? request.body.newPassword : ''

    const old_password = String(old_password_raw)
    const new_password = String(new_password_raw)

    if (!old_password || !new_password) {
      return response.status(400).json({ message: 'Old password and new password are required' })
    }

    if (new_password.length < 8) {
      return response.status(400).json({ message: 'New password must be at least 8 characters long' })
    }

    const user = await User.findById(auth_user.userId)
    if (!user) {
      return response.status(404).json({ message: 'User not found' })
    }

    const is_match = await user.comparePassword(old_password)
    if (!is_match) {
      return response.status(400).json({ message: 'Old password is incorrect' })
    }

    user.password = new_password
    await user.save()

    return response.json({ message: 'Password changed successfully' })
  } catch (error) {
    const msg = error && error.message ? error.message : error
    console.error('Change password error:', msg)
    return response.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
