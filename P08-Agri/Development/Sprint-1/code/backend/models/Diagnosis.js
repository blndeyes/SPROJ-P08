const mongoose = require('mongoose')

// this describes a single plant diagnosis result
const diagnosis_schema = new mongoose.Schema({
  user_id: {
    // link to the user who requested the diagnosis
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  diagnosis: {
    // label predicted by the ml model
    type: String,
    required: true
  },
  confidence: {
    // probability score for the main label
    type: Number,
    required: true
  },
  alternatives: [{
    // other possible labels with their scores
    label: String,
    confidence: Number
  }],
  recommendations: [String],
  processing_ms: {
    // how long inference took in milliseconds
    type: Number
  },
  created_at: {
    // when this record was created
    type: Date,
    default: Date.now
  }
})

// index to make per user queries fast with newest first
diagnosis_schema.index({ user_id: 1, created_at: -1 })

module.exports = mongoose.model('Diagnosis', diagnosis_schema)
