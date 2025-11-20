const mongoose = require('mongoose')

// complaint record for a user submitted help or support request
// tracks who sent it, what it is about, and current handling state
const complaint_schema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // reference to the user who filed the complaint
    },
    subject: {
      type: String,
      required: true,
      trim: true // short title for the complaint
    },
    message: {
      type: String,
      required: true,
      trim: true // detailed description of the issue or request
    },
    status: {
      type: String,
      enum: ['not addressed', 'addressed'],
      default: 'not addressed' // basic workflow state for processing
    }
  },
  {
    timestamps: true // automatically adds createdat and updatedat fields
  }
)

module.exports = mongoose.model('Complaint', complaint_schema)
