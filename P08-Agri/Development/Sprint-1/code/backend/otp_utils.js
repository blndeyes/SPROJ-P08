const crypto = require('crypto')

function generate_otp() {
  // create a 6 digit code as a string
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  return otp
}

function hash_otp(otp) {
  // hash the otp so we never store it in plain text
  const hash = crypto.createHash('sha256').update(otp).digest('hex')
  return hash
}

module.exports = {
  generate_otp,
  hash_otp
}
