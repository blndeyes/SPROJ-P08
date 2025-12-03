const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// describes the structure for a user document
const userSchema = new mongoose.Schema({
  // ... existing code ...
  name: {
    // full name
    type: String,
    required: true,
    trim: true
  },
  email: {
    // unique email, stored in lowercase
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    // optional contact number
    type: String,
    trim: true
  },
  password: {
    // hashed password
    type: String,
    required: true
  },
  role: {
    // role controls access in the app
    type: String,
    enum: ['farmer', 'inspector', 'admin'],
    default: 'farmer'
  },
  emailVerified: {
    // indicates if email ownership was verified
    type: Boolean,
    default: false
  },
  passwordHistory: {
    // store hashes of recent passwords to prevent reuse
    type: [String],
    default: []
  },
  createdAt: {
    // when the user was created
    type: Date,
    default: Date.now
  }
});

// hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    // When changing password, prevent reuse of recent passwords
    const PasswordHistoryLimit = 5;
    const candidatePlaintext = this.password;

    // Fetch existing document to access current hash and existing history
    let existing = null;
    if (!this.isNew && this._id) {
      existing = await this.constructor.findById(this._id).select('password passwordHistory').lean();
    }

    const priorHashes = [];
    if (existing && typeof existing.password === 'string' && existing.password.length > 0) {
      priorHashes.push(existing.password);
    }
    if (existing && Array.isArray(existing.passwordHistory) && existing.passwordHistory.length > 0) {
      for (const h of existing.passwordHistory) {
        if (typeof h === 'string' && h.length > 0) {
          priorHashes.push(h);
        }
      }
    }

    // Compare candidate against prior hashes
    for (const hash of priorHashes) {
      const isReuse = await bcrypt.compare(candidatePlaintext, hash);
      if (isReuse) {
        const error = new Error('New password must not match any of your recent passwords');
        error.code = 'PASSWORD_REUSE';
        throw error;
      }
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(candidatePlaintext, salt);
    this.password = newHash;

    // Update history by adding the previous current hash (if existed) and trimming to limit
    if (existing && typeof existing.password === 'string' && existing.password.length > 0) {
      const updatedHistory = Array.isArray(existing.passwordHistory) ? [...existing.passwordHistory] : [];
      updatedHistory.unshift(existing.password);
      // trim to limit
      while (updatedHistory.length > PasswordHistoryLimit) {
        updatedHistory.pop();
      }
      this.passwordHistory = updatedHistory;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// compare a plain text password with the stored hash
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);