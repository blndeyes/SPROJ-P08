const nodemailer = require('nodemailer')
const axios = require('axios')

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

function resolve_from_email() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || ''
}

function get_email_provider() {
  const provider_raw = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim()
  if (provider_raw === 'smtp') return 'smtp'
  if (provider_raw === 'sendgrid') return 'sendgrid'
  // Auto-detect if not specified: prefer SMTP when configured, else SendGrid
  if (process.env.SMTP_USER) return 'smtp'
  if (process.env.SENDGRID_API_KEY) return 'sendgrid'
  return 'none'
}

async function send_via_sendgrid(to, subject, text) {
  const api_key = process.env.SENDGRID_API_KEY
  if (!api_key) return false

  const from_email = resolve_from_email()
  if (!from_email) {
    console.error('SENDGRID: EMAIL_FROM or SMTP_USER is required as sender address')
    return false
  }

  try {
    const url = 'https://api.sendgrid.com/v3/mail/send'
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from_email },
      subject,
      content: [{ type: 'text/plain', value: text }]
    }
    await axios.post(url, payload, {
      headers: {
        Authorization: 'Bearer ' + api_key,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    })
    return true
  } catch (e) {
    const msg = e && e.response && e.response.data ? JSON.stringify(e.response.data) : (e && e.message ? e.message : e)
    console.error('SendGrid send failed:', msg)
    return false
  }
}

async function send_email(to, subject, text) {
  const provider = get_email_provider()
  if (provider === 'smtp') {
    if (!process.env.SMTP_USER) {
      console.error('SMTP chosen but SMTP_USER not set; email not sent')
    } else {
      const mail_options = {
        from: resolve_from_email(),
        to,
        subject,
        text
      }
      await transporter.sendMail(mail_options)
      return
    }
  }
  if (provider === 'sendgrid') {
    const ok = await send_via_sendgrid(to, subject, text)
    if (ok) return
    console.error('SendGrid sending failed or not configured; email not sent')
    return
  }
  // Auto-detect fallback (if EMAIL_PROVIDER not set)
  if (process.env.SMTP_USER) {
    const mail_options = {
      from: resolve_from_email(),
      to,
      subject,
      text
    }
    await transporter.sendMail(mail_options)
    return
  }
  if (process.env.SENDGRID_API_KEY) {
    const ok = await send_via_sendgrid(to, subject, text)
    if (ok) return
  }
  // Development fallback
  console.log('[DEV EMAIL - not sent]', { to, subject, text })
}

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
  const subject = 'Your AgriQual verification code'
  const text = 'Your verification code is ' + otp + '. It will expire in 10 minutes.'
  await send_email(recipient_email, subject, text)
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

  // prepend a small tag to make filtering easy
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

  await send_email(to_email, final_subject, body_text)
}

async function send_password_change_email(recipient_email) {
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
  await send_email(recipient_email, subject, body_lines.join('\n'))
}

module.exports = {
  send_otp_email,
  send_help_email,
  send_password_change_email
}
