import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { verifyOtp } from '../../services/authService'

function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()

  const stateEmail = location.state && location.state.email ? location.state.email : ''
  const storedEmail = localStorage.getItem('pending_signup_email') || ''

  const [email] = useState(stateEmail || storedEmail)
  const [otp, setOtp] = useState('')
  const [errorText, setErrorText] = useState('')
  const [infoText, setInfoText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!email) {
      setErrorText('No pending signup found. Please register again.')
    } else {
      setInfoText('We have sent a verification code to ' + email + '. Enter it below to complete signup.')
    }
  }, [email])

  function handleOtpChange(e) {
    if (isLoading) {
      return
    }
    const value = e.target.value.replace(/[^0-9]/g, '')
    setOtp(value)
    setErrorText('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (isLoading) {
      return
    }
    if (!email) {
      setErrorText('No pending signup found. Please register again.')
      return
    }
    if (!otp || otp.length < 4) {
      setErrorText('Please enter the verification code.')
      return
    }

    setIsLoading(true)
    setErrorText('')
    try {
      const data = await verifyOtp({ email, otp })

      localStorage.removeItem('pending_signup_email')

      const role = data && data.user && data.user.role ? data.user.role : null
      if (role === 'farmer') {
        navigate('/farmer-dashboard')
      } else if (role === 'inspector' || role === 'admin') {
        navigate('/inspector-dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const message = err && err.message ? err.message : 'Invalid code. Please try again.'
      setErrorText(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Verification Error</h2>
          <p className="text-sm text-gray-600">{errorText || 'Something went wrong.'}</p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md"
          >
            Go back to Register
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Verify your email</h2>
          {infoText && <p className="mt-2 text-sm text-gray-600">{infoText}</p>}
        </div>

        {errorText && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {errorText}
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="otp" className="text-sm font-medium text-gray-700">
              Enter 6-digit code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={handleOtpChange}
              disabled={isLoading}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-center tracking-widest text-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading && (
              <svg
                className="animate-spin h-5 w-5 mr-2 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Enter the code sent to <span className="font-medium">{email}</span>. If you did not receive it, check your
            spam folder or try registering again.
          </p>
        </form>
      </div>
    </div>
  )
}

export default VerifyOtp
