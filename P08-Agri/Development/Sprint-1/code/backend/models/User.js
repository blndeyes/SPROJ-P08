const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// user account document for login and role based access
const userSchema = new mongoose.Schema({
  // full name
  name: {
    type: String,
    required: true,
    trim: true
  },
  // unique email used as login id
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // optional contact number
  phone: {
    type: String,
    trim: true
  },
  // hashed password is stored here
  password: {
    type: String,
    required: true
  },
  // basic roles supported by the app
  role: {
    type: String,
    enum: ['farmer', 'inspector', 'admin'],
    default: 'farmer'
  },
  // becomes true after email verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  // record creation time
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next(); // skip if password was not changed
  
  try {
    const salt = await bcrypt.genSalt(10); // generate salt
    this.password = await bcrypt.hash(this.password, salt); // replace plain with hash
    next();
  } catch (error) {
    next(error);
  }
});

// compare a plain password to the stored hash
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password); // true if matches
};

module.exports = mongoose.model('User', userSchema);