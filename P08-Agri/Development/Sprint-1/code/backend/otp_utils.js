const crypto = require('crypto')

function generate_otp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  return otp
}

function hash_otp(otp) {
  const hash = crypto.createHash('sha256').update(otp).digest('hex')
  return hash
}

module.exports = {
  generate_otp,
  hash_otp
}
