const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

async function send_otp_email(recipient_email, otp) {
  if (!process.env.SMTP_USER) {
    console.log('OTP for', recipient_email, 'is', otp)
    return
  }

  const mail_options = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: recipient_email,
    subject: 'Your AgriQual verification code',
    text: 'Your verification code is ' + otp + '. It will expire in 10 minutes.'
  }

  await transporter.sendMail(mail_options)
}

async function send_help_email(payload) {
  const subject_raw = payload && payload.subject ? payload.subject : ''
  const message_raw = payload && payload.message ? payload.message : ''
  const user_email = payload && payload.userEmail ? payload.userEmail : ''

  const subject = String(subject_raw)
  const message = String(message_raw)

  const to_email = '26100370@lums.edu.pk'

  if (!process.env.SMTP_USER) {
    console.log('Help email (not actually sent). To:', to_email)
    console.log('From user:', user_email)
    console.log('Subject:', subject)
    console.log('Message:', message)
    return
  }

  const from_email = process.env.EMAIL_FROM || process.env.SMTP_USER
  const final_subject = '[AgriQual Help] ' + subject

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

module.exports = {
  send_otp_email,
  send_help_email
}
