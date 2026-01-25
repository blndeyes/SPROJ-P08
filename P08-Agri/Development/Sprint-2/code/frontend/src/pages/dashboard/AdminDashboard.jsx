import React, { useCallback, useEffect, useState } from 'react'
import {
  fetch_complaints,
  update_complaint_status,
  send_admin_email,
  respond_to_complaint,
  reset_farmer_password
} from '../../services/adminService'

function format_date(dateString) {
  if (!dateString) {
    return 'Unknown'
  }
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function AdminDashboard() {
  const [complaints, set_complaints] = useState([])
  const [total, set_total] = useState(0)
  const [is_loading, set_is_loading] = useState(true)
  const [error_text, set_error_text] = useState('')
  const [status_filter, set_status_filter] = useState('')
  const [show_complaints, set_show_complaints] = useState(false)
  const [active_response_id, set_active_response_id] = useState(null)
  const [response_text, set_response_text] = useState('')
  const [response_status_text, set_response_status_text] = useState('')
  const [is_sending_response, set_is_sending_response] = useState(false)

  const [email_subject, set_email_subject] = useState('')
  const [email_message, set_email_message] = useState('')
  const [email_mode, set_email_mode] = useState('all')
  const [recipient_list, set_recipient_list] = useState('')
  const [email_status_text, set_email_status_text] = useState('')
  const [is_sending_email, set_is_sending_email] = useState(false)
  const [reset_email, set_reset_email] = useState('')
  const [reset_password, set_reset_password] = useState('')
  const [reset_status_text, set_reset_status_text] = useState('')
  const [is_resetting_password, set_is_resetting_password] = useState(false)

  const load_complaints = useCallback(async () => {
    set_is_loading(true)
    set_error_text('')
    try {
      const data = await fetch_complaints({ status: status_filter })
      set_complaints(data.complaints || [])
      set_total(data.total || 0)
    } catch (error) {
      set_error_text(error?.message || 'Failed to load complaints')
    } finally {
      set_is_loading(false)
    }
  }, [status_filter])

  useEffect(() => {
    if (show_complaints) {
      load_complaints()
    }
  }, [load_complaints, show_complaints])

  async function handle_mark_addressed(id) {
    try {
      await update_complaint_status(id, 'addressed')
      await load_complaints()
    } catch (error) {
      set_error_text(error?.message || 'Failed to update complaint')
    }
  }

  async function handle_mark_unaddressed(id) {
    try {
      await update_complaint_status(id, 'not addressed')
      await load_complaints()
    } catch (error) {
      set_error_text(error?.message || 'Failed to update complaint')
    }
  }

  async function handle_send_email(e) {
    e.preventDefault()
    if (is_sending_email) {
      return
    }

    const subject = email_subject.trim()
    const message = email_message.trim()
    if (!subject || !message) {
      set_email_status_text('Subject and message are required')
      return
    }

    let recipients = []
    if (email_mode === 'specific') {
      recipients = recipient_list
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
      if (recipients.length === 0) {
        set_email_status_text('Enter at least one recipient email')
        return
      }
    }

    set_is_sending_email(true)
    set_email_status_text('')

    try {
      const result = await send_admin_email({
        subject,
        message,
        mode: email_mode,
        recipients
      })
      if (result.failed > 0) {
        set_email_status_text(`Sent ${result.sent}, failed ${result.failed}`)
      } else {
        set_email_status_text(`Sent ${result.sent} emails successfully`)
      }
      set_email_subject('')
      set_email_message('')
      set_recipient_list('')
    } catch (error) {
      set_email_status_text(error?.message || 'Failed to send emails')
    } finally {
      set_is_sending_email(false)
    }
  }

  async function handle_start_response(complaint_id) {
    set_active_response_id(complaint_id)
    set_response_text('')
    set_response_status_text('')
  }

  function handle_cancel_response() {
    if (is_sending_response) {
      return
    }
    set_active_response_id(null)
    set_response_text('')
    set_response_status_text('')
  }

  async function handle_send_response(complaint) {
    if (is_sending_response) {
      return
    }

    const trimmed = response_text.trim()
    if (!trimmed) {
      set_response_status_text('Response message is required')
      return
    }

    set_is_sending_response(true)
    set_response_status_text('')
    set_error_text('')

    try {
      await respond_to_complaint(complaint._id, trimmed)
      set_response_status_text('Response sent successfully')
      set_active_response_id(null)
      set_response_text('')
      await load_complaints()
    } catch (error) {
      set_response_status_text(error?.message || 'Failed to send response')
    } finally {
      set_is_sending_response(false)
    }
  }

  async function handle_reset_password(e) {
    e.preventDefault()
    if (is_resetting_password) {
      return
    }

    const email = reset_email.trim().toLowerCase()
    const newPassword = reset_password.trim()

    if (!email) {
      set_reset_status_text('Farmer email is required')
      return
    }

    set_is_resetting_password(true)
    set_reset_status_text('')

    try {
      await reset_farmer_password({ email, newPassword: newPassword || undefined })
      set_reset_status_text('Password updated and emailed to farmer')
      set_reset_email('')
      set_reset_password('')
    } catch (error) {
      set_reset_status_text(error?.message || 'Failed to reset password')
    } finally {
      set_is_resetting_password(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-green-700 uppercase">AgriQual Admin</p>
          <h1 className="text-2xl font-bold text-green-700">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Manage complaints and contact users</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m0 0l4-4m-4 4l4 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Email Users</h2>
              <p className="text-sm text-gray-600 mt-1">Send updates to all users or selected emails</p>
            </div>
          </div>
          <div className="p-6">
          {email_status_text && (
            <div className="mb-4 text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded">
              {email_status_text}
            </div>
          )}
          <form className="space-y-4" onSubmit={handle_send_email}>
            <div>
              <label className="text-sm font-medium text-gray-700">Send to</label>
              <div className="mt-2 flex gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="email_mode"
                    value="all"
                    checked={email_mode === 'all'}
                    onChange={() => set_email_mode('all')}
                  />
                  All users
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="email_mode"
                    value="specific"
                    checked={email_mode === 'specific'}
                    onChange={() => set_email_mode('specific')}
                  />
                  Specific users
                </label>
              </div>
            </div>

            {email_mode === 'specific' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Recipient emails</label>
                  <input
                  type="text"
                  value={recipient_list}
                  onChange={(e) => set_recipient_list(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={is_sending_email}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={email_subject}
                onChange={(e) => set_email_subject(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={is_sending_email}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Message</label>
              <textarea
                rows={4}
                value={email_message}
                onChange={(e) => set_email_message(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={is_sending_email}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-60"
                disabled={is_sending_email}
              >
                {is_sending_email ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </form>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V7m0 8h.01M5.07 18a7 7 0 1113.86 0H5.07z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reset Farmer Password</h2>
              <p className="text-sm text-gray-600 mt-1">Set a new password and email it to the farmer</p>
            </div>
          </div>
          <div className="p-6">
            {reset_status_text && (
              <div className="mb-4 text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded">
                {reset_status_text}
              </div>
            )}
            <form className="space-y-4" onSubmit={handle_reset_password}>
              <div>
                <label className="text-sm font-medium text-gray-700">Farmer email</label>
                <input
                  type="email"
                  value={reset_email}
                  onChange={(e) => set_reset_email(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="farmer@example.com"
                  disabled={is_resetting_password}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">New password (optional)</label>
                <input
                  type="text"
                  value={reset_password}
                  onChange={(e) => set_reset_password(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Leave blank to auto-generate"
                  disabled={is_resetting_password}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-60"
                  disabled={is_resetting_password}
                >
                  {is_resetting_password ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Complaints</h2>
              <p className="text-sm text-gray-600">{total} total complaints</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => set_show_complaints((prev) => !prev)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                {show_complaints ? 'Hide Complaints' : 'Complaints'}
              </button>
              {show_complaints && (
                <>
                  <select
                    value={status_filter}
                    onChange={(e) => set_status_filter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">All statuses</option>
                    <option value="not addressed">Not addressed</option>
                    <option value="addressed">Addressed</option>
                  </select>
                  <button
                    type="button"
                    onClick={load_complaints}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    disabled={is_loading}
                  >
                    Refresh
                  </button>
                </>
              )}
            </div>
          </div>

          {show_complaints && (
            <div className="p-6">
              {error_text && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {error_text}
                </div>
              )}

              {is_loading && (
                <div className="text-sm text-gray-500">Loading complaints...</div>
              )}

              {!is_loading && complaints.length === 0 && (
                <div className="text-sm text-gray-500">No complaints found.</div>
              )}

              {!is_loading && complaints.length > 0 && (
                <div className="space-y-4">
                  {complaints.map((complaint) => {
                    const is_unanswered = complaint.status !== 'addressed'
                    const show_response_box = active_response_id === complaint._id
                    return (
                      <div
                        key={complaint._id}
                        className={`border rounded-lg p-4 ${
                          is_unanswered ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div>
                            <p className="text-sm text-gray-500">{format_date(complaint.createdAt)}</p>
                            <h3 className="text-base font-semibold text-gray-900">{complaint.subject}</h3>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{complaint.message}</p>
                            <p className="text-xs text-gray-500 mt-2">From: {complaint.userEmail}</p>
                          </div>
                          <div className="flex flex-col gap-2 items-start sm:items-end">
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                complaint.status === 'addressed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {complaint.status}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                onClick={() => handle_mark_addressed(complaint._id)}
                                disabled={complaint.status === 'addressed'}
                              >
                                Mark addressed
                              </button>
                              <button
                                type="button"
                                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                onClick={() => handle_mark_unaddressed(complaint._id)}
                                disabled={complaint.status === 'not addressed'}
                              >
                                Mark open
                              </button>
                              <button
                                type="button"
                                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                onClick={() => handle_start_response(complaint._id)}
                              >
                                Respond
                              </button>
                            </div>
                          </div>
                        </div>

                        {show_response_box && (
                          <div className="mt-4 border-t border-red-200 pt-4">
                            {response_status_text && (
                              <div className="mb-3 text-sm text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded">
                                {response_status_text}
                              </div>
                            )}
                            <label className="text-sm font-medium text-gray-700">Response</label>
                            <textarea
                              rows={4}
                              value={response_text}
                              onChange={(e) => set_response_text(e.target.value)}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              disabled={is_sending_response}
                            />
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                onClick={handle_cancel_response}
                                disabled={is_sending_response}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600"
                                onClick={() => handle_send_response(complaint)}
                                disabled={is_sending_response}
                              >
                                {is_sending_response ? 'Sending...' : 'Send response'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard
