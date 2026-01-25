const mongoose = require('mongoose')

const adminSeedSchema = new mongoose.Schema(
  {
    usedAt: {
      type: Date
    },
    createdAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    collection: 'admin_seed_state',
    timestamps: true
  }
)

module.exports = mongoose.model('AdminSeed', adminSeedSchema)
