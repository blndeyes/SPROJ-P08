const crypto = require('crypto')

// create a 6 digit numeric code as string
function generate_otp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  return otp
}

// sha256 hash the otp so we never store the raw code
function hash_otp(otp) {
  const hash = crypto.createHash('sha256').update(otp).digest('hex')
  return hash
}

module.exports = {
  generate_otp,
  hash_otp
}
