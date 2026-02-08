import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { registerWithOtp, googleSignIn } from '../../services/authService'
import { useLanguage } from '../../contexts/LanguageContext'

function Register() {
  const navigate = useNavigate()
  const { t, language, setLanguage, direction } = useLanguage()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'farmer'
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const name = e.target.name
    const value = e.target.value
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    setApiError('')
  }

  function validateForm() {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = t.register.nameRequired
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = t.register.validEmailRequired
    }

    if (formData.phone && !/^\d{10,}$/.test(formData.phone.replace(/[^0-9]/g, ''))) {
      newErrors.phone = t.register.validPhoneRequired
    }

    if (!formData.password) {
      newErrors.password = t.register.passwordRequired
    } else if (formData.password.length < 8) {
      newErrors.password = t.register.passwordMinLength
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t.register.passwordsDoNotMatch
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function redirectByRole() {
    const userJson = localStorage.getItem('user')
    if (!userJson) {
      navigate('/dashboard')
      return
    }
    try {
      const user = JSON.parse(userJson)
      const role = user?.role
      if (role === 'farmer') navigate('/farmer-dashboard')
      else if (role === 'admin') navigate('/admin-dashboard')
      else if (role === 'inspector') navigate('/inspector-dashboard')
      else navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setApiError('')
    setLoading(true)
    try {
      const token = credentialResponse?.credential
      if (!token) {
        setApiError('Google sign-up did not return a credential.')
        return
      }
      await googleSignIn(token, formData.role)
      redirectByRole()
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err && err.message ? err.message : 'Google sign-up failed.')
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleFailure() {
    setApiError('Google sign-up was cancelled or failed.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setApiError('')
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role
      }

      await registerWithOtp(userData)

      localStorage.setItem('pending_signup_email', userData.email)

      navigate('/verify-otp', { state: { email: userData.email } })
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err && err.message ? err.message : t.register.registrationFailed)
      setApiError(msg)
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-[28px] font-semibold text-[#1B1B1B]">Create your account</h1>
            <p className="mt-2 text-[15px] text-[#6B7280]">Join AgriQual to get started</p>
          </div>

          {apiError && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#DC2626] px-4 py-3 rounded-lg text-sm">
              {apiError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.register.fullNameLabel}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                placeholder={t.register.fullNamePlaceholder}
              />
              {errors.name && <p className="mt-1.5 text-xs text-[#DC2626]">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.register.emailLabel}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                placeholder={t.register.emailPlaceholder}
              />
              {errors.email && <p className="mt-1.5 text-xs text-[#DC2626]">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.register.phoneLabel}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                placeholder={t.register.phonePlaceholder}
              />
              {errors.phone && <p className="mt-1.5 text-xs text-[#DC2626]">{errors.phone}</p>}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.register.roleLabel}
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] bg-white focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
              >
                <option value="farmer">{t.register.roleFarmer}</option>
                <option value="inspector">{t.register.roleInspector}</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.register.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2.5 pr-10 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1B1B1B] transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-[#DC2626]">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.register.confirmPasswordLabel}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-[#DC2626]">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F4A261] text-white rounded-lg px-5 py-2.5 font-medium transition-all duration-150 hover:bg-[#e89451] active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              {loading ? t.register.sendingOtp : t.register.createAccountButton}
            </button>

          {process.env.REACT_APP_GOOGLE_CLIENT_ID && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or sign up with Google</span>
                </div>
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleFailure}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  type="standard"
                  shape="rectangular"
                  text="signup_with"
                  width="320"
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Uses the role selected above ({formData.role}) for new accounts.
              </p>
            </>
          )}

            <p className="text-xs text-[#6B7280] text-center">
              {t.register.termsText}{' '}
              <Link to="/terms" className="text-[#2D6A4F] hover:text-[#52B788] transition-colors">
                {t.register.termsOfService}
              </Link>{' '}
              {t.register.and}{' '}
              <Link to="/privacy" className="text-[#2D6A4F] hover:text-[#52B788] transition-colors">
                {t.register.privacyPolicy}
              </Link>
            </p>
          </form>

          <p className="text-center text-sm text-[#6B7280]">
            {t.register.alreadyHaveAccount}{' '}
            <Link to="/login" className="text-[#2D6A4F] hover:text-[#52B788] font-medium transition-colors">
              {t.register.signIn}
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1 bg-[#2D6A4F] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] to-[#1a4d35] opacity-90"></div>
        <div className="relative h-full flex items-center justify-center p-12">
          <div className="max-w-md text-white space-y-6">
            <h2 className="text-[28px] font-semibold leading-tight">Start your journey with AgriQual</h2>
            <p className="text-[#B8E0D2] leading-relaxed text-[15px]">
              Join thousands of wheat farmers in Pakistan who are already using AgriQual to protect their crops, increase yields, and farm smarter with AI-powered insights.
            </p>
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Free account with instant access</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">AI-powered disease detection in seconds</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Expert recommendations tailored to your region</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Track your field health over time</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
