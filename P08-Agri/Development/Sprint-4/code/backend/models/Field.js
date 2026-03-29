/**
 * A farmer’s wheat plot: metadata only; health comes from the latest diagnosis linked to this field.
 */
const mongoose = require('mongoose')

const field_schema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  wheat_variety: {
    type: String,
    trim: true,
    default: ''
  },
  sowing_date: {
    type: String,
    trim: true,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
})

field_schema.index({ user_id: 1, created_at: -1 })

module.exports = mongoose.model('Field', field_schema)
