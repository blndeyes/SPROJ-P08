import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { verifyOtp } from '../../services/authService'
import { useLanguage } from '../../contexts/LanguageContext'

function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, language, setLanguage, direction } = useLanguage()

  const stateEmail = location.state && location.state.email ? location.state.email : ''
  const storedEmail = localStorage.getItem('pending_signup_email') || ''

  const [email] = useState(stateEmail || storedEmail)
  const [otp, setOtp] = useState('')
  const [errorText, setErrorText] = useState('')
  const [infoText, setInfoText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!email) {
      setErrorText(t.verifyOtp.noPendingSignup)
    } else {
      setInfoText(`${t.verifyOtp.verificationSent} ${email}. ${t.verifyOtp.enterBelow}`)
    }
  }, [email, t])

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
      setErrorText(t.verifyOtp.noPendingSignup)
      return
    }
    if (!otp || otp.length < 4) {
      setErrorText(t.verifyOtp.enterVerificationCode)
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
      } else if (role === 'admin') {
        navigate('/admin-dashboard')
      } else if (role === 'inspector') {
        navigate('/inspector-dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      const message = err && err.message ? err.message : t.verifyOtp.invalidCode
      setErrorText(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-[#FAFDF7] flex relative">
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
            className="px-2.5 py-1 text-[12px] bg-[#EDF2E8] text-[#5A6E52] rounded-md hover:bg-[#D5DDD0] transition-colors"
          >
            {language === 'en' ? '\u0627\u0631\u062f\u0648' : 'English'}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div dir={direction} className="max-w-md w-full space-y-6 text-center">
            <h2 className="text-[28px] font-semibold text-[#1B1B1B]">{t.verifyOtp.verificationError}</h2>
            <p className="text-[15px] text-[#6B7280]">{errorText || t.verifyOtp.somethingWentWrong}</p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center mt-4 px-5 py-2.5 bg-[#F4A261] hover:bg-[#e89451] text-white font-medium rounded-lg transition-all duration-150 shadow-sm"
            >
              {t.verifyOtp.goBackToRegister}
            </Link>
          </div>
        </div>
        <div className="hidden lg:block lg:flex-1 bg-[#2D6A4F] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] to-[#1a4d35] opacity-90"></div>
          <div className="relative h-full flex items-center justify-center p-12">
            <div className="max-w-md text-white space-y-6">
              <h2 className="text-[28px] font-semibold leading-tight">Secure Account Verification</h2>
              <p className="text-[#B8E0D2] leading-relaxed text-[15px]">
                We've sent a verification code to your email to ensure the security of your account and protect your agricultural data.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFDF7] flex relative">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
          className="px-2.5 py-1 text-[12px] bg-[#EDF2E8] text-[#5A6E52] rounded-md hover:bg-[#D5DDD0] transition-colors"
        >
          {language === 'en' ? '\u0627\u0631\u062f\u0648' : 'English'}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div dir={direction} className="max-w-md w-full space-y-6">
          <div>
            <h1 className="text-[28px] font-semibold text-[#1B1B1B]">{t.verifyOtp.title}</h1>
            {infoText && <p className="mt-2 text-[15px] text-[#6B7280]">{infoText}</p>}
          </div>

          {errorText && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#DC2626] px-4 py-3 rounded-lg text-sm">
              {errorText}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.verifyOtp.codeLabel}
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
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-center tracking-widest text-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#F4A261] text-white rounded-lg px-5 py-2.5 font-medium transition-all duration-150 hover:bg-[#e89451] active:scale-[0.98] disabled:opacity-50 shadow-sm flex items-center justify-center"
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
              {isLoading ? t.verifyOtp.verifying : t.verifyOtp.verifyButton}
            </button>

            <p className="text-xs text-[#6B7280] text-center">
              {t.verifyOtp.codeInfo} <span className="font-medium text-[#1B1B1B]">{email}</span>. {t.verifyOtp.noCodeReceived}
            </p>
          </form>
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1 bg-[#2D6A4F] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] to-[#1a4d35] opacity-90"></div>
        <div className="relative h-full flex items-center justify-center p-12">
          <div className="max-w-md text-white space-y-6">
            <h2 className="text-[28px] font-semibold leading-tight">One more step to get started</h2>
            <p className="text-[#B8E0D2] leading-relaxed text-[15px]">
              We've sent a 6-digit verification code to your email. Enter it below to activate your AgriQual account and start protecting your wheat crops.
            </p>
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Your data is encrypted and secure</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Code expires in 10 minutes</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span className="text-sm">Check your spam folder if you can't find it</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyOtp
