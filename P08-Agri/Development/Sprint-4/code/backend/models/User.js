/**
 * User accounts: profile, roles, passwords (legacy plain + current hash), email verification, OTP, and optional Google ID.
 */
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String
    },

    role: {
      type: String,
      default: 'farmer'
    },

    password: {
      type: String,
      required: false
    },

    password_hash: {
      type: String,
      required: false
    },

    email_verified: {
      type: Boolean,
      default: false
    },

    pending_otp_hash: {
      type: String
    },

    pending_otp_expires_at: {
      type: Date
    },

    failed_login_attempts: {
      type: Number,
      default: 0
    },

    lock_until: {
      type: Date
    },

    google_id: {
      type: String,
      required: false,
      sparse: true,
      unique: true
    }
  },
  {
    timestamps: true
  }
)

const User = mongoose.model('User', userSchema)

module.exports = User
