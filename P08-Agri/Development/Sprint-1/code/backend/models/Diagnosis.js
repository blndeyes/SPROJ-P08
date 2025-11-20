const mongoose = require('mongoose')

const diagnosis_schema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  diagnosis: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  alternatives: [{
    label: String,
    confidence: Number
  }],
  recommendations: [String],
  processing_ms: {
    type: Number
  },
  created_at: {
    type: Date,
    default: Date.now
  }
})

diagnosis_schema.index({ user_id: 1, created_at: -1 })

module.exports = mongoose.model('Diagnosis', diagnosis_schema)
