/* eslint-disable jsx-a11y/role-has-required-aria-props */
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetch_complaints,
  update_complaint_status,
  send_admin_email,
  respond_to_complaint,
  reset_farmer_password
} from '../../services/adminService'

const VIEW_HOME = 'home'
const VIEW_EMAIL = 'email'
const VIEW_COMPLAINTS = 'complaints'
const VIEW_RESET = 'reset'

function format_date(dateString) {
  if (!dateString) return 'Unknown'
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
  const navigate = useNavigate()
  const userJson = localStorage.getItem('user') || '{}'
  const user = (() => {
    try {
      return JSON.parse(userJson)
    } catch {
      return {}
    }
  })()
  const userName = user?.name || 'Admin'
  const userInitial = (userName.charAt(0) || 'A').toUpperCase()

  const [view, set_view] = useState(VIEW_HOME)
  const [user_dropdown_open, set_user_dropdown_open] = useState(false)
  const [filter_dropdown_open, set_filter_dropdown_open] = useState(false)

  const [complaints, set_complaints] = useState([])
  const [total, set_total] = useState(0)
  const [unaddressed_count, set_unaddressed_count] = useState(0)
  const [is_loading, set_is_loading] = useState(true)
  const [error_text, set_error_text] = useState('')
  const [status_filter, set_status_filter] = useState('')
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

  function handle_logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  useEffect(() => {
    if (view === VIEW_COMPLAINTS) {
      load_complaints()
    }
  }, [view, load_complaints])

  const load_unaddressed_count = useCallback(async () => {
    try {
      const data = await fetch_complaints({ status: 'not addressed' })
      set_unaddressed_count(data.total || 0)
    } catch {
      set_unaddressed_count(0)
    }
  }, [])

  useEffect(() => {
    if (view === VIEW_HOME) {
      load_unaddressed_count()
    }
  }, [view, load_unaddressed_count])

  async function handle_mark_addressed(id) {
    try {
      await update_complaint_status(id, 'addressed')
      await load_complaints()
    } catch (error) {
      set_error_text(error?.message || 'Failed to update complaint')
    }
  }

  async function handle_send_email(e) {
    e.preventDefault()
    if (is_sending_email) return
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

  function handle_start_response(complaint_id) {
    set_active_response_id(complaint_id)
    set_response_text('')
    set_response_status_text('')
  }

  function handle_cancel_response() {
    if (is_sending_response) return
    set_active_response_id(null)
    set_response_text('')
    set_response_status_text('')
  }

  async function handle_send_response(complaint) {
    if (is_sending_response) return
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
    if (is_resetting_password) return
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

  function BackButton({ onClick }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500"
        aria-label="Back"
      >
        <svg className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7fdf9]">
      <header className="bg-[#2D6A4F] shadow-sm border-b border-[#1a4d35]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1.5">
              <img
                src="/agriqual-logo.png"
                alt="AgriQual"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">AgriQual</span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => set_user_dropdown_open((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-[#2D6A4F] font-semibold text-sm">{userInitial}</span>
              </div>
              <span className="text-sm font-medium text-white hidden sm:inline">{userName}</span>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {user_dropdown_open && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => set_user_dropdown_open(false)}
                />
                <div className="absolute right-0 mt-1 w-48 py-1 bg-white rounded-lg shadow-lg border border-[#2D6A4F] z-20">
                  <button
                    type="button"
                    onClick={() => {
                      set_user_dropdown_open(false)
                      handle_logout()
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ---------- HOME: 3 cards ---------- */}
        {view === VIEW_HOME && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-emerald-800">Admin Dashboard</h1>
            </div>
            <div className="space-y-4">
              {/* Email Users card */}
              <button
                type="button"
                onClick={() => set_view(VIEW_EMAIL)}
                className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
              >
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-6 w-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h2 className="text-lg font-semibold text-gray-900">Email Users</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Send updates to all users or selected emails</p>
                </div>
                <span className="flex items-center gap-1 text-[#2D6A4F] font-medium text-sm flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Open
                </span>
              </button>

              {/* Complaints card */}
              <button
                type="button"
                onClick={() => set_view(VIEW_COMPLAINTS)}
                className="relative w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
              >
                {unaddressed_count > 0 && (
                  <span className="absolute top-3 left-3 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
                    {unaddressed_count > 99 ? '99+' : unaddressed_count}
                  </span>
                )}
                <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h2 className="text-lg font-semibold text-gray-900">Complaints</h2>
                  <p className="text-sm text-gray-500 mt-0.5">View, filter, and respond to complaints</p>
                </div>
                <span className="flex items-center gap-1 text-[#2D6A4F] font-medium text-sm flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Open
                </span>
              </button>

              {/* Reset Password card */}
              <button
                type="button"
                onClick={() => set_view(VIEW_RESET)}
                className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
              >
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-6 w-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Reset farmer password and email it</p>
                </div>
                <span className="flex items-center gap-1 text-[#2D6A4F] font-medium text-sm flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Open
                </span>
              </button>
            </div>
          </>
        )}

        {/* ---------- EMAIL USERS screen ---------- */}
        {view === VIEW_EMAIL && (
          <section className="bg-white rounded-xl shadow-sm border border-[#2D6A4F] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2D6A4F] flex items-center gap-3">
              <BackButton onClick={() => set_view(VIEW_HOME)} />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Email Users</h2>
                <p className="text-sm text-gray-500 mt-0.5">Send updates to all users or selected emails</p>
              </div>
            </div>
            <div className="p-6">
              {email_status_text && (
                <div className="mb-4 text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
                  {email_status_text}
                </div>
              )}
              <form className="space-y-4" onSubmit={handle_send_email}>
                <div>
                  <label className="text-sm font-medium text-gray-700">Send to</label>
                  <div className="mt-2 flex gap-6 text-sm text-gray-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="email_mode"
                        value="all"
                        checked={email_mode === 'all'}
                        onChange={() => set_email_mode('all')}
                        className="text-green-600 focus:ring-green-500"
                      />
                      All users
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="email_mode"
                        value="specific"
                        checked={email_mode === 'specific'}
                        onChange={() => set_email_mode('specific')}
                        className="text-green-600 focus:ring-green-500"
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
                      className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
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
                    className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                    disabled={is_sending_email}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    rows={4}
                    value={email_message}
                    onChange={(e) => set_email_message(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] resize-y"
                    disabled={is_sending_email}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-2 focus:border-[#2D6A4F] disabled:opacity-60 font-medium border border-[#1a4d35]"
                    disabled={is_sending_email}
                  >
                    {is_sending_email ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------- COMPLAINTS screen ---------- */}
        {view === VIEW_COMPLAINTS && (
          <section className="bg-white rounded-xl shadow-sm border border-[#2D6A4F] overflow-visible">
            <div className="px-6 py-4 border-b border-[#2D6A4F] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <BackButton onClick={() => set_view(VIEW_HOME)} />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Complaints</h2>
                  <p className="text-sm text-gray-500">{total} total complaints</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => set_filter_dropdown_open((prev) => !prev)}
                    className="p-2 text-[#2D6A4F] hover:bg-[#2D6A4F]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 cursor-pointer"
                    title="Filter by status"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  {filter_dropdown_open && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => set_filter_dropdown_open(false)}
                      />
                      <div
                        className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-[#2D6A4F] bg-white py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            set_status_filter('')
                            set_filter_dropdown_open(false)
                          }}
                          className={`block w-full px-4 py-2 text-left text-sm focus:outline-none focus:bg-green-50 hover:bg-green-50 ${
                            status_filter === '' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          All statuses
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            set_status_filter('not addressed')
                            set_filter_dropdown_open(false)
                          }}
                          className={`block w-full px-4 py-2 text-left text-sm focus:outline-none focus:bg-green-50 hover:bg-green-50 ${
                            status_filter === 'not addressed' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          Not addressed
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            set_status_filter('addressed')
                            set_filter_dropdown_open(false)
                          }}
                          className={`block w-full px-4 py-2 text-left text-sm focus:outline-none focus:bg-green-50 hover:bg-green-50 ${
                            status_filter === 'addressed' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          Addressed
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={load_complaints}
                  className="p-2 text-[#2D6A4F] hover:bg-[#2D6A4F]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 disabled:opacity-60 cursor-pointer"
                  disabled={is_loading}
                  title="Refresh"
                >
                  <svg className={`h-5 w-5 ${is_loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              {error_text && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {error_text}
                </div>
              )}
              {is_loading && (
                <div className="text-sm text-gray-500 py-4">Loading complaints...</div>
              )}
              {!is_loading && complaints.length === 0 && (
                <div className="text-sm text-gray-500 py-4">No complaints found.</div>
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
                          is_unanswered ? 'border-red-200 bg-red-50/50' : 'border-[#2D6A4F] bg-white'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-500">{format_date(complaint.createdAt)}</p>
                            <h3 className="text-base font-semibold text-gray-900 mt-1">{complaint.subject}</h3>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{complaint.message}</p>
                            <p className="text-xs text-gray-500 mt-2">From: {complaint.userEmail}</p>
                          </div>
                          <div className="flex flex-col gap-2 items-start sm:items-end flex-shrink-0">
                            {complaint.status === 'addressed' ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                                Addressed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
                                Not addressed
                              </span>
                            )}
                          </div>
                        </div>
                        {(!complaint.response?.trim() || complaint.status !== 'addressed') && (
                          <div className="mt-3 flex justify-between items-center">
                            {!complaint.response?.trim() && (
                              <button
                                type="button"
                                className="px-3 py-1.5 text-xs bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 font-medium"
                                onClick={() => handle_start_response(complaint._id)}
                              >
                                Respond
                              </button>
                            )}
                            {complaint.status !== 'addressed' && (
                              <button
                                type="button"
                                className="px-3 py-1.5 text-xs bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 font-medium"
                                onClick={() => handle_mark_addressed(complaint._id)}
                              >
                                Mark as addressed
                              </button>
                            )}
                          </div>
                        )}
                        {show_response_box && (
                          <div className="mt-4 border-t border-[#2D6A4F] pt-4">
                            {response_status_text && (
                              <div className="mb-3 text-sm text-gray-700 bg-white border border-[#2D6A4F] px-3 py-2 rounded-lg">
                                {response_status_text}
                              </div>
                            )}
                            <label className="text-sm font-medium text-gray-700">Response</label>
                            <textarea
                              rows={4}
                              value={response_text}
                              onChange={(e) => set_response_text(e.target.value)}
                              className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                              disabled={is_sending_response}
                            />
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 font-medium"
                                onClick={handle_cancel_response}
                                disabled={is_sending_response}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="px-4 py-2 text-sm bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 font-medium"
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
          </section>
        )}

        {/* ---------- RESET PASSWORD screen ---------- */}
        {view === VIEW_RESET && (
          <section className="bg-white rounded-xl shadow-sm border border-[#2D6A4F] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2D6A4F] flex items-center gap-3">
              <BackButton onClick={() => set_view(VIEW_HOME)} />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Reset Farmer Password</h2>
                <p className="text-sm text-gray-500 mt-0.5">Set a new password and email it to the farmer</p>
              </div>
            </div>
            <div className="p-6">
              {reset_status_text && (
                <div className="mb-4 text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
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
                    className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
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
                    className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                    placeholder="Leave blank to auto-generate"
                    disabled={is_resetting_password}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 disabled:opacity-60 font-medium"
                    disabled={is_resetting_password}
                  >
                    {is_resetting_password ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
