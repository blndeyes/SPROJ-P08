const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// describes the structure for a user document
const userSchema = new mongoose.Schema({
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
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
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