const mongoose = require('mongoose')

// diagnosis record saved after model inference
// links a prediction to the user and stores metadata like confidence and processing time
const diagnosis_schema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // which user this result belongs to
    required: true
  },
  diagnosis: {
    type: String,
    required: true // top predicted label
  },
  confidence: {
    type: Number,
    required: true // probability for the top label
  },
  alternatives: [{
    label: String,      // other likely labels
    confidence: Number  // their probabilities
  }],
  recommendations: [String], // suggested next steps for the user
  processing_ms: {
    type: Number // time spent to process the request
  },
  created_at: {
    type: Date,
    default: Date.now // when this record was created
  }
})

diagnosis_schema.index({ user_id: 1, created_at: -1 }) // fast lookup for a user history newest first

module.exports = mongoose.model('Diagnosis', diagnosis_schema)
