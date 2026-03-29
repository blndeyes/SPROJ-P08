/**
 * Sign-in with email/password or Google; language toggle; links to register.
 */
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { login as login_api, googleSignIn } from "../../services/authService";
import { useLanguage } from "../../contexts/LanguageContext";

function Login() {
  const navigate = useNavigate();
  const { t, language, setLanguage, direction } = useLanguage();
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [error_text, set_error_text] = useState("");
  const [is_loading, set_is_loading] = useState(false);
  const [show_password, set_show_password] = useState(false);

  function redirect_by_role() {
    const userJson = localStorage.getItem("user");
    if (!userJson) {
      navigate("/dashboard");
      return;
    }
    try {
      const user = JSON.parse(userJson);
      const role = user?.role;
      if (role === "farmer") navigate("/farmer-dashboard");
      else if (role === "admin") navigate("/admin-dashboard");
      else if (role === "inspector") navigate("/inspector-dashboard");
      else navigate("/dashboard");
    } catch {
      navigate("/dashboard");
    }
  }

  async function handle_submit(e) {
    e.preventDefault();
    set_error_text("");
    set_is_loading(true);
    try {
      await login_api({ email, password });
      redirect_by_role();
    } catch (err) {
      const message = err && err.message ? err.message : t.login.loginFailed;
      set_error_text(message);
    } finally {
      set_is_loading(false);
    }
  }

  async function handle_google_success(credentialResponse) {
    set_error_text("");
    set_is_loading(true);
    try {
      const token = credentialResponse?.credential;
      if (!token) {
        set_error_text("Google sign-in did not return a credential.");
        return;
      }
      await googleSignIn(token);
      redirect_by_role();
    } catch (err) {
      const message = err && err.message ? err.message : "Google sign-in failed.";
      set_error_text(message);
    } finally {
      set_is_loading(false);
    }
  }

  function handle_google_failure() {
    set_error_text("Google sign-in was cancelled or failed.");
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
            <h1 className="text-[28px] font-semibold text-[#1B1B1B]">{t.login.title}</h1>
            <p className="mt-2 text-[15px] text-[#6B7280]">{t.login.subtitle}</p>
          </div>

          {error_text && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#DC2626] px-4 py-3 rounded-lg text-sm">
              {error_text}
            </div>
          )}

          <form className="space-y-5" onSubmit={handle_submit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.login.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                disabled={is_loading}
                className="w-full px-3 py-2.5 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                placeholder={t.login.emailPlaceholder}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
                {t.login.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show_password ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => set_password(e.target.value)}
                  disabled={is_loading}
                  className="w-full px-3 py-2.5 pr-10 border border-[#D1D5DB] rounded-lg text-[#1B1B1B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all duration-150 disabled:bg-gray-50"
                  placeholder={t.login.passwordPlaceholder}
                  required
                />
                <button
                  type="button"
                  onClick={() => set_show_password(!show_password)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1B1B1B] transition-colors"
                >
                  {show_password ? (
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
            </div>

            <div className="flex items-center justify-between">
              <Link to="/forgot-password" className="text-sm text-[#2D6A4F] hover:text-[#52B788] transition-colors">
                {t.login.forgotPassword}
              </Link>
            </div>

            <button
              type="submit"
              disabled={is_loading}
              className="w-full bg-[#F4A261] text-white rounded-lg px-5 py-2.5 font-medium transition-all duration-150 hover:bg-[#e89451] active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              {is_loading ? t.login.loggingIn : t.login.loginButton}
            </button>

            {process.env.REACT_APP_GOOGLE_CLIENT_ID && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E0E7DD]"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-[#FAFDF7] text-[#6B7280]">{t.login.orDivider}</span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handle_google_success}
                    onError={handle_google_failure}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    type="standard"
                    shape="rectangular"
                    text="signin_with"
                    width="320"
                    disabled={is_loading}
                  />
                </div>
              </>
            )}
          </form>

          <p className="text-center text-sm text-[#6B7280]">
            {t.login.noAccount}{' '}
            <Link to="/register" className="text-[#2D6A4F] hover:text-[#52B788] font-medium transition-colors">
              {t.login.signUp}
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1 bg-[#2D6A4F] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] to-[#1a4d35] opacity-90"></div>
        <div className="relative h-full flex items-center justify-center p-12">
          <div className="max-w-md text-white space-y-6">
            <h2 className="text-[28px] font-semibold leading-tight">{t.login.heroTitle}</h2>
            <p className="text-[#B8E0D2] leading-relaxed text-[15px]">
              {t.login.heroDescription}
            </p>
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{t.login.heroFeature1}</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{t.login.heroFeature2}</span>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#52B788] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{t.login.heroFeature3}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
