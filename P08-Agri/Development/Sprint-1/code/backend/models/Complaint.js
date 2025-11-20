const mongoose = require('mongoose')

// this describes what a help complaint document looks like
const complaint_schema = new mongoose.Schema(
  {
    userEmail: {
      // email of the user who submitted the complaint
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    userId: {
      // user id reference to the users collection
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    subject: {
      // short title for the complaint
      type: String,
      required: true,
      trim: true
    },
    message: {
      // detailed description of the issue
      type: String,
      required: true,
      trim: true
    },
    status: {
      // current handling status for support
      type: String,
      enum: ['not addressed', 'addressed'],
      default: 'not addressed'
    }
  },
  {
    // automatically adds createdat and updatedat fields
    timestamps: true
  }
)

module.exports = mongoose.model('Complaint', complaint_schema)
