const nodemailer = require('nodemailer')

// basic smtp transporter using env config
const smtp_port = Number(process.env.SMTP_PORT) || 587
const smtp_secure =
  typeof process.env.SMTP_SECURE === 'string'
    ? process.env.SMTP_SECURE.toLowerCase() === 'true'
    : smtp_port === 465

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtp_port,
  secure: smtp_secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// Best-effort verification at startup to catch misconfiguration in logs
;(async function verifySmtp() {
  if (!process.env.SMTP_USER) return
  try {
    await transporter.verify()
    // console.log('SMTP connection verified')
  } catch (e) {
    console.error('SMTP verification failed:', e && e.message ? e.message : e)
  }
})()

async function send_otp_email(recipient_email, otp) {
  // if smtp is not configured just log the otp for testing
  if (!process.env.SMTP_USER) {
    console.log('OTP for', recipient_email, 'is', otp)
    return
  }

  // simple email with a plaintext code and expiry note
  const mail_options = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: recipient_email,
    subject: 'Your AgriQual verification code',
    text: 'Your verification code is ' + otp + '. It will expire in 10 minutes.'
  }

  await transporter.sendMail(mail_options)
}

async function send_help_email(payload) {
  // read inputs and normalize to strings
  const subject_raw = payload && payload.subject ? payload.subject : ''
  const message_raw = payload && payload.message ? payload.message : ''
  const user_email = payload && payload.userEmail ? payload.userEmail : ''

  const subject = String(subject_raw)
  const message = String(message_raw)

  // the recipient for help requests
  const to_email = '26100370@lums.edu.pk'

  // if smtp is not configured just log the email details
  if (!process.env.SMTP_USER) {
    console.log('Help email (not actually sent). To:', to_email)
    console.log('From user:', user_email)
    console.log('Subject:', subject)
    console.log('Message:', message)
    return
  }

  // prepend a small tag to make filtering easy
  const from_email = process.env.EMAIL_FROM || process.env.SMTP_USER
  const final_subject = '[AgriQual Help] ' + subject

  // construct a simple plaintext body
  const body_lines = [
    'New help request from: ' + (user_email || 'Unknown user'),
    '',
    'Subject: ' + subject,
    '',
    'Message:',
    message
  ]
  const body_text = body_lines.join('\n')

  const mail_options = {
    from: from_email,
    to: to_email,
    subject: final_subject,
    text: body_text
  }

  await transporter.sendMail(mail_options)
}

async function send_password_change_email(recipient_email) {
  // If SMTP is not configured, log for development only
  if (!process.env.SMTP_USER) {
    console.log('Password change notification (not actually sent). To:', recipient_email)
    return
  }

  const from_email = process.env.EMAIL_FROM || process.env.SMTP_USER
  const subject = 'Your AgriQual password was changed'
  const body_lines = [
    'Hello,',
    '',
    'This is a confirmation that your account password was changed.',
    '',
    'If you did not make this change, please reset your password immediately and contact support.',
    '',
    '— AgriQual Security'
  ]
  const mail_options = {
    from: from_email,
    to: recipient_email,
    subject,
    text: body_lines.join('\n')
  }
  await transporter.sendMail(mail_options)
}

module.exports = {
  send_otp_email,
  send_help_email,
  send_password_change_email
}
