const mongoose = require('mongoose')

// Lightweight security/audit event for sensitive actions
const security_event_schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      // e.g., 'password_change_attempt', 'password_change_success', 'password_change_failure'
      type: String,
      required: true,
      trim: true
    },
    ip: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    success: {
      type: Boolean,
      default: false
    },
    meta: {
      // any additional context (avoid sensitive data)
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
)

security_event_schema.index({ userId: 1, createdAt: -1 })
security_event_schema.index({ type: 1, createdAt: -1 })

module.exports = mongoose.model('SecurityEvent', security_event_schema)


