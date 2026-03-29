/**
 * Shared Resend email helpers: OTP, complaints, admin broadcasts, password notices.
 */
const { Resend } = require('resend')

let resend_client = null

function get_resend_client() {
  if (resend_client) {
    return resend_client
  }

  if (!process.env.RESEND_API_KEY) {
    return null
  }

  resend_client = new Resend(process.env.RESEND_API_KEY)
  return resend_client
}

async function send_otp_email(recipient_email = '', otp = '') {
  if (!recipient_email || !otp) {
    throw new Error('Missing recipient_email or otp')
  }

  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('OTP for', recipient_email, 'is', otp)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'

  const text_lines = [
    'Your AgriQual verification code is: ' + otp,
    '',
    'This code will expire in 10 minutes.',
    '',
    'If you did not request this code, you can ignore this email.'
  ]

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('OTP for', recipient_email, 'is', otp)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const result = await client.emails.send({
    from: from_email,
    to: [recipient_email],
    subject: 'Your AgriQual verification code',
    text: text_lines.join('\n')
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('Resend OTP email id:', result.id)
  }
}

async function send_help_email(payload = {}) {
  const subject = String(payload?.subject || '')
  const message = String(payload?.message || '')
  const user_email = String(payload?.userEmail || '').trim()
  const ticket_id = String(payload?.ticketId || '').trim()

  const to_email = process.env.SUPPORT_TO_EMAIL || 'zarakqadirkhan02@gmail.com'

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Help email (not actually sent). To:', to_email)
      console.log('From user:', user_email || 'Unknown user')
      if (ticket_id) {
        console.log('Ticket ID:', ticket_id)
      }
      console.log('Subject:', subject)
      console.log('Message:', message)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'
  const final_subject = '[AgriQual Help] ' + subject

  const body_lines = [
    ...(ticket_id ? ['Ticket ID: ' + ticket_id, ''] : []),
    'New help request from: ' + (user_email || 'Unknown user'),
    '',
    'Subject: ' + subject,
    '',
    'Message:',
    message
  ]

  const result = await client.emails.send({
    from: from_email,
    to: [to_email],
    subject: final_subject,
    text: body_lines.join('\n')
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('Resend help email id:', result.id)
  }
}

async function send_password_change_email(recipient_email = '') {
  if (!recipient_email) {
    throw new Error('Missing recipient_email')
  }

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Password change notification (not actually sent). To:', recipient_email)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'

  const lines = [
    'Hello,',
    '',
    'This is a confirmation that the password for your AgriQual account was changed.',
    '',
    'If you made this change, no further action is needed.',
    'If you did NOT change your password, please reset it immediately and contact support.',
    '',
    'This email was sent automatically. Please do not reply.'
  ]

  const result = await client.emails.send({
    from: from_email,
    to: [recipient_email],
    subject: 'Your AgriQual password was changed',
    text: lines.join('\n')
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('Resend password change email id:', result.id)
  }
}

async function send_admin_broadcast_email(payload = {}) {
  const recipient_email = String(payload?.recipient_email || '').trim()
  const subject = String(payload?.subject || '').trim()
  const message = String(payload?.message || '').trim()

  if (!recipient_email || !subject || !message) {
    throw new Error('Missing recipient_email, subject, or message')
  }

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Admin broadcast (not sent). To:', recipient_email)
      console.log('Subject:', subject)
      console.log('Message:', message)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'
  const final_subject = '[AgriQual Admin] ' + subject

  const result = await client.emails.send({
    from: from_email,
    to: [recipient_email],
    subject: final_subject,
    text: message
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('Resend admin broadcast email id:', result.id)
  }
}

async function send_complaint_response_email(payload = {}) {
  const recipient_email = String(payload?.recipient_email || '').trim()
  const subject = String(payload?.subject || '').trim()
  const response_text = String(payload?.response || '').trim()
  const original_message = String(payload?.original_message || '').trim()

  if (!recipient_email || !subject || !response_text) {
    throw new Error('Missing recipient_email, subject, or response')
  }

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Complaint response (not sent). To:', recipient_email)
      console.log('Subject:', subject)
      console.log('Response:', response_text)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'
  const final_subject = '[AgriQual Support] ' + subject

  const body_lines = [
    'Hello,',
    '',
    'We have reviewed your support request. Here is our response:',
    '',
    response_text,
    '',
    ...(original_message ? ['Your original message:', original_message, ''] : []),
    'Thank you for contacting AgriQual.'
  ]

  const result = await client.emails.send({
    from: from_email,
    to: [recipient_email],
    subject: final_subject,
    text: body_lines.join('\n')
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('Resend complaint response email id:', result.id)
  }
}

async function send_admin_password_reset_email(payload = {}) {
  const recipient_email = String(payload?.recipient_email || '').trim()
  const new_password = String(payload?.new_password || '').trim()

  if (!recipient_email || !new_password) {
    throw new Error('Missing recipient_email or new_password')
  }

  const client = get_resend_client()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Admin reset password (not sent). To:', recipient_email)
      console.log('New password:', new_password)
      return
    }
    throw new Error('RESEND_API_KEY is not set')
  }

  const from_email = process.env.EMAIL_FROM || 'AgriQual <onboarding@resend.dev>'
  const subject = 'Your AgriQual password was reset'

  const body_lines = [
    'Hello,',
    '',
    'An admin has reset your AgriQual password.',
    'Your new temporary password is:',
    '',
    new_password,
    '',
    'Please log in and change this password as soon as possible.',
    'If you did not request this, contact support immediately.'
  ]

  const result = await client.emails.send({
    from: from_email,
    to: [recipient_email],
    subject,
    text: body_lines.join('\n')
  })

  if (result && result.error) {
    throw new Error(String(result.error.message || 'Resend failed'))
  }

  if (result && result.id) {
    console.log('Resend admin reset email id:', result.id)
  }
}

module.exports = {
  send_otp_email,
  send_help_email,
  send_password_change_email,
  send_admin_broadcast_email,
  send_complaint_response_email,
  send_admin_password_reset_email
}
