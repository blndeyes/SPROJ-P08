import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetch_weather_by_coords } from '../../services/weatherService'
import { diagnose_image } from '../../services/diagnoseService'
import { send_complaint } from '../../services/helpService'
import { changePassword } from '../../services/authService'
import { send_chat_message } from '../../services/chatService'
import { useLanguage } from '../../contexts/LanguageContext'

/* Helper functions to reduce cognitive complexity */
function buildChatIntroMessage(diagnoseResult, t) {
  const confidence = typeof diagnoseResult.confidence === 'number' 
    ? (diagnoseResult.confidence * 100).toFixed(1) 
    : 'unknown'
  
  const confidenceText = confidence !== 'unknown' 
    ? `${t.farmerDashboard.withConfidence} ${confidence}${t.farmerDashboard.confidencePercent} `
    : ''
  
  return {
    role: 'assistant',
    content: `${t.farmerDashboard.analyzedWheatImage} "${diagnoseResult.diagnosis}" ${confidenceText}${t.farmerDashboard.askFollowUp}`
  }
}

function validateHelpForm(subject, message, t) {
  const trimmedSubject = subject.trim()
  const trimmedMessage = message.trim()
  if (!trimmedSubject || !trimmedMessage) {
    return { isValid: false, error: t.farmerDashboard.helpFieldsRequired }
  }
  return { isValid: true, subject: trimmedSubject, message: trimmedMessage }
}

function validatePasswordChange(old1, old2, newPass, t) {
  const trimmedOld1 = old1.trim()
  const trimmedOld2 = old2.trim()
  const trimmedNew = newPass.trim()
  if (!trimmedOld1 || !trimmedOld2 || !trimmedNew) {
    return { isValid: false, error: t.farmerDashboard.passwordFieldsRequired }
  }
  if (trimmedOld1 !== trimmedOld2) {
    return { isValid: false, error: t.farmerDashboard.oldPasswordMismatch }
  }
  if (trimmedNew.length < 6) {
    return { isValid: false, error: t.farmerDashboard.newPasswordTooShort }
  }
  return { isValid: true }
}

function FarmerDashboard() {
  const navigate = useNavigate()
  const { t, language, setLanguage, direction } = useLanguage()
  const user_json = localStorage.getItem('user') || '{}'
  const user = JSON.parse(user_json)

  const [is_getting_weather, set_is_getting_weather] = useState(false)
  const [weather_error, set_weather_error] = useState('')
  const [weather_data, set_weather_data] = useState(null)

  const [selected_file, set_selected_file] = useState(null)
  const [preview_url, set_preview_url] = useState('')
  const [is_uploading, set_is_uploading] = useState(false)
  const [diagnose_error, set_diagnose_error] = useState('')
  const [diagnose_result, set_diagnose_result] = useState(null)
  const file_input_ref = useRef(null)

  const [is_help_open, set_is_help_open] = useState(false)
  const [help_subject, set_help_subject] = useState('')
  const [help_message, set_help_message] = useState('')
  const [help_error_text, set_help_error_text] = useState('')
  const [help_success_text, set_help_success_text] = useState('')
  const [is_sending_help, set_is_sending_help] = useState(false)

  const [is_profile_menu_open, set_is_profile_menu_open] = useState(false)
  const [is_change_password_open, set_is_change_password_open] = useState(false)
  const [old_password_first, set_old_password_first] = useState('')
  const [old_password_second, set_old_password_second] = useState('')
  const [new_password, set_new_password] = useState('')
  const [cp_error_text, set_cp_error_text] = useState('')
  const [cp_success_text, set_cp_success_text] = useState('')
  const [is_changing_password, set_is_changing_password] = useState(false)

  const [is_chat_open, set_is_chat_open] = useState(false)
  const [chat_messages, set_chat_messages] = useState([])
  const [chat_input, set_chat_input] = useState('')
  const [is_sending_chat, set_is_sending_chat] = useState(false)
  const [chat_error_text, set_chat_error_text] = useState('')

  const [is_scan_modal_open, set_is_scan_modal_open] = useState(false)


  function handle_logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  function get_browser_location() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error(t.farmerDashboard.geolocationNotAvailable))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error(t.farmerDashboard.locationPermissionDenied)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      )
    })
  }

  async function handle_get_weather() {
    if (is_getting_weather) return
    set_is_getting_weather(true)
    set_weather_error('')
    set_weather_data(null)
    try {
      const coords = await get_browser_location()
      const data = await fetch_weather_by_coords(coords.latitude, coords.longitude)
      set_weather_data(data)
    } catch (error) {
      set_weather_error(error && error.message ? error.message : t.farmerDashboard.weatherFetchFailed)
    } finally {
      set_is_getting_weather(false)
    }
  }

  function handle_click_upload_button() {
    if (file_input_ref.current) file_input_ref.current.click()
  }

  function handle_file_change(e) {
    const file = e.target.files && e.target.files[0]
    if (file) {
      set_selected_file(file)
      set_preview_url(URL.createObjectURL(file))
      set_diagnose_result(null)
      set_diagnose_error('')
      set_is_chat_open(false)
      set_chat_messages([])
      set_chat_input('')
      set_chat_error_text('')
      set_is_scan_modal_open(true)
    }
  }

  async function handle_analyze_click() {
    if (!selected_file) { set_diagnose_error('Please select an image'); return }
    set_is_uploading(true)
    set_diagnose_error('')
    set_diagnose_result(null)
    set_is_chat_open(false)
    set_chat_messages([])
    set_chat_input('')
    set_chat_error_text('')
    try {
      const data = await diagnose_image(selected_file)
      set_diagnose_result(data)
    } catch (err) {
      set_diagnose_error(err && err.message ? err.message : t.farmerDashboard.analysisFailed)
    } finally {
      set_is_uploading(false)
    }
  }

  useEffect(() => {
    if (diagnose_result) {
      const introMessage = buildChatIntroMessage(diagnose_result, t)
      set_is_chat_open(true)
      set_chat_messages([introMessage])
      set_chat_input('')
      set_chat_error_text('')
    } else {
      set_is_chat_open(false)
      set_chat_messages([])
      set_chat_input('')
      set_chat_error_text('')
    }
  }, [diagnose_result, t])

  function open_help_modal() {
    set_help_subject('')
    set_help_message('')
    set_help_error_text('')
    set_help_success_text('')
    set_is_sending_help(false)
    set_is_help_open(true)
  }
  function close_help_modal() {
    if (is_sending_help) return
    set_is_help_open(false)
  }
  function handle_help_subject_change(e) {
    set_help_subject(e.target.value)
    if (help_error_text) set_help_error_text('')
    if (help_success_text) set_help_success_text('')
  }
  function handle_help_message_change(e) {
    set_help_message(e.target.value)
    if (help_error_text) set_help_error_text('')
    if (help_success_text) set_help_success_text('')
  }

  async function handle_help_submit(e) {
    e.preventDefault()
    if (is_sending_help) return
    
    const validation = validateHelpForm(help_subject, help_message, t)
    if (!validation.isValid) {
      set_help_error_text(validation.error)
      return
    }
    
    set_is_sending_help(true)
    set_help_error_text('')
    set_help_success_text('')
    try {
      await send_complaint({ subject: validation.subject, message: validation.message })
      set_help_success_text(t.farmerDashboard.helpSubmitSuccess)
      set_help_subject('')
      set_help_message('')
    } catch (error) {
      set_help_error_text(error && error.message ? error.message : t.farmerDashboard.helpSubmitFailed)
    } finally { set_is_sending_help(false) }
  }

  function toggle_profile_menu() { set_is_profile_menu_open((prev) => !prev) }

  function open_change_password_modal() {
    set_is_profile_menu_open(false)
    set_old_password_first('')
    set_old_password_second('')
    set_new_password('')
    set_cp_error_text('')
    set_cp_success_text('')
    set_is_changing_password(false)
    set_is_change_password_open(true)
  }
  function close_change_password_modal() {
    if (is_changing_password) return
    set_is_change_password_open(false)
  }
  function handle_old_password_first_change(e) {
    set_old_password_first(e.target.value)
    if (cp_error_text) set_cp_error_text('')
    if (cp_success_text) set_cp_success_text('')
  }
  function handle_old_password_second_change(e) {
    set_old_password_second(e.target.value)
    if (cp_error_text) set_cp_error_text('')
    if (cp_success_text) set_cp_success_text('')
  }
  function handle_new_password_change(e) {
    set_new_password(e.target.value)
    if (cp_error_text) set_cp_error_text('')
    if (cp_success_text) set_cp_success_text('')
  }

  async function handle_change_password_submit(e) {
    e.preventDefault()
    if (is_changing_password) return
    
    const validation = validatePasswordChange(old_password_first, old_password_second, new_password, t)
    if (!validation.isValid) {
      set_cp_error_text(validation.error)
      return
    }
    
    set_is_changing_password(true)
    set_cp_error_text('')
    set_cp_success_text('')
    try {
      await changePassword({ oldPassword: old_password_first, newPassword: new_password })
      set_cp_success_text(t.farmerDashboard.passwordChangeSuccess)
      set_old_password_first('')
      set_old_password_second('')
      set_new_password('')
    } catch (error) {
      set_cp_error_text(error && error.message ? error.message : t.farmerDashboard.passwordChangeFailed)
    } finally {
      set_is_changing_password(false)
    }
  }

  function handle_chat_input_change(e) { set_chat_input(e.target.value); if (chat_error_text) set_chat_error_text('') }

  async function handle_chat_submit(e) {
    e.preventDefault()
    if (is_sending_chat || !chat_input.trim()) return
    const userMessage = chat_input.trim()
    set_chat_messages((prev) => [...prev, { role: 'user', content: userMessage }])
    set_chat_input('')
    set_is_sending_chat(true)
    set_chat_error_text('')
    try {
      const response = await send_chat_message(userMessage, diagnose_result)
      set_chat_messages((prev) => [...prev, { role: 'assistant', content: response.reply }])
    } catch (error) {
      set_chat_error_text(error && error.message ? error.message : t.farmerDashboard.chatSendFailed)
    } finally { set_is_sending_chat(false) }
  }

  function clear_diagnosis() {
    set_selected_file(null); set_preview_url(''); set_diagnose_result(null); set_diagnose_error('')
    set_is_chat_open(false); set_chat_messages([]); set_chat_input(''); set_chat_error_text('')
    set_is_scan_modal_open(false)
    if (file_input_ref.current) file_input_ref.current.value = ''
  }

  /* ─── DATA ─── */
  const fields = [
    { name: 'North Field', status: 'healthy', area: '5 acres', variety: 'Punjab-11', sowing: 'Oct 2024', location: 'Lahore, Punjab', health: 92 },
    { name: 'East Field', status: 'attention', area: '3 acres', variety: 'Faisalabad-2008', sowing: 'Nov 2024', location: 'Lahore, Punjab', health: 45 },
    { name: 'South Field', status: 'healthy', area: '7 acres', variety: 'Sehar-2006', sowing: 'Oct 2024', location: 'Lahore, Punjab', health: 88 },
  ]

  const userName = user?.name || 'Farmer'
  const userInitial = (userName.charAt(0) || 'F').toUpperCase()

  /* ─── RENDER ─── */
  return (
    <div dir={direction} className="min-h-screen bg-[#f7fdf9]">
      {/* ─── NAVBAR ─── */}
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
          <div className={`flex ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'} items-center gap-4`}>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
              className="px-2 py-1 text-sm bg-white/20 text-white rounded-md hover:bg-white/30 transition-colors"
            >
              {language === 'en' ? '\u0627\u0631\u062f\u0648' : 'English'}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={toggle_profile_menu}
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
              {is_profile_menu_open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => set_is_profile_menu_open(false)} />
                  <div className="absolute right-0 mt-1 w-48 py-1 bg-white rounded-lg shadow-lg border border-[#2D6A4F] z-20">
                    <button type="button" onClick={open_change_password_modal} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      {t.farmerDashboard.changePassword}
                    </button>
                    <button type="button" onClick={open_help_modal} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      {t.farmerDashboard.needHelp}
                    </button>
                    <div className="border-t border-gray-200"></div>
                    <button onClick={handle_logout} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      {t.farmerDashboard.logout}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <input ref={file_input_ref} type="file" accept="image/*" className="hidden" onChange={handle_file_change} />

      {/* ─── MAIN ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── HEADING ─── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-emerald-800">
            {t.farmerDashboard.welcome}, {userName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.farmerDashboard.manageFarmsSubtitle || 'Manage your fields, scan crops, and track your harvest health.'}</p>
        </div>

        {/* ─── ACTION CARDS ─── */}
        <div className="space-y-4">
          {/* CARD 1: Upload Wheat Image */}
          <button
            type="button"
            onClick={handle_click_upload_button}
            className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
          >
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h2 className="text-lg font-semibold text-gray-900">{t.farmerDashboard.uploadImage}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t.farmerDashboard.dropImageText || 'Drop an image or click to browse'}</p>
            </div>
            <span className="flex items-center gap-1 text-[#2D6A4F] font-medium text-sm flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Open
            </span>
          </button>

          {/* CARD 2: Current Weather */}
          {!weather_data && (
            <button
              type="button"
              onClick={handle_get_weather}
              disabled={is_getting_weather}
              className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer disabled:opacity-60"
            >
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
              </svg>
            </div>
              <div className="flex-1 min-w-0 text-left">
                <h2 className="text-lg font-semibold text-gray-900">{t.farmerDashboard.currentWeather}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t.farmerDashboard.checkWeatherSubtitle || 'Check today\'s conditions for your area'}</p>
              </div>
              <div className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d35]">
                {is_getting_weather ? t.farmerDashboard.gettingWeather : t.farmerDashboard.getWeather}
              </div>
            </button>
          )}

          {/* CARD 2 EXPANDED: Weather Details */}
          {weather_data && (
            <section className="bg-white rounded-xl shadow-sm border border-[#2D6A4F] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2D6A4F] flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set_weather_data(null)}
                  className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.currentWeather}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{weather_data.city}</p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <p className="text-xs uppercase text-gray-500 font-medium mb-1">Temp</p>
                    <p className="text-2xl font-bold text-gray-900">{weather_data.current.temperature_c}°</p>
                    <p className="text-xs text-gray-500 mt-1">{weather_data.current.condition}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <p className="text-xs uppercase text-gray-500 font-medium mb-1">{t.farmerDashboard.windSpeed || 'Wind'}</p>
                    <p className="text-2xl font-bold text-gray-900">{weather_data.current.wind_speed_kmh}</p>
                    <p className="text-xs text-gray-500 mt-1">km/h</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <p className="text-xs uppercase text-gray-500 font-medium mb-1">{t.farmerDashboard.humidity || 'Humidity'}</p>
                    <p className="text-2xl font-bold text-gray-900">{weather_data.current.humidity}</p>
                    <p className="text-xs text-gray-500 mt-1">%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <p className="text-xs uppercase text-gray-500 font-medium mb-1">{t.farmerDashboard.uvIndex || 'UV'}</p>
                    <p className="text-2xl font-bold text-gray-900">{weather_data.today.uv_index_max}</p>
                    <p className="text-xs text-gray-500 mt-1">Index</p>
                  </div>
                </div>
                {weather_data.advice && weather_data.advice.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <p className="text-sm font-semibold text-yellow-900 mb-1">Tip</p>
                    <p className="text-sm text-yellow-800 leading-relaxed">{weather_data.advice[0]}</p>
                  </div>
                )}
                {weather_data.llm_advice && (
                  <div className="mt-3 bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-[#2D6A4F] mb-1">{t.farmerDashboard.aiAssistant}</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{weather_data.llm_advice}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {weather_error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{weather_error}</div>
          )}

          {/* CARD 3: My Wheat Fields (always expanded) */}
          <section className="bg-white rounded-xl shadow-sm border border-[#2D6A4F] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2D6A4F] flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.myWheatFields}</h2>
              <button type="button" className="text-sm text-[#2D6A4F] font-medium hover:underline">
                + {t.farmerDashboard.addNewField}
              </button>
            </div>
            <div className="p-6 divide-y divide-gray-100">
              {fields.map((field) => {
                const isAlert = field.status === 'attention'
                return (
                  <div key={field.name} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{field.name}</span>
                        {isAlert ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-800">
                            {t.farmerDashboard.needsAttention}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-green-100 text-green-700">
                            {t.farmerDashboard.healthy}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{field.area} · {field.variety}</span>
                    </div>
                    {/* Health bar */}
                    <div className="w-full h-2 rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isAlert ? 'bg-[#F59E0B]' : 'bg-[#2D6A4F]'}`}
                        style={{ width: `${field.health}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* CARD 4: View History */}
          <button
            type="button"
            onClick={() => navigate('/diagnostic-history')}
            className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
          >
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h2 className="text-lg font-semibold text-gray-900">{t.farmerDashboard.viewHistory}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t.farmerDashboard.pastScans}</p>
            </div>
            <span className="flex items-center gap-1 text-[#2D6A4F] font-medium text-sm flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Open
            </span>
          </button>

          {/* CARD 5: Need Help */}
          <button
            type="button"
            onClick={open_help_modal}
            className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
          >
            <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h2 className="text-lg font-semibold text-gray-900">{t.farmerDashboard.needHelp}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t.farmerDashboard.contactSupport}</p>
            </div>
            <span className="flex items-center gap-1 text-[#2D6A4F] font-medium text-sm flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Open
            </span>
          </button>
        </div>
      </main>

      {/* ─── HELP MODAL ─── */}
      {is_help_open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.needHelp}</h2>
              <button type="button" onClick={close_help_modal} className="text-gray-400 hover:text-gray-600" disabled={is_sending_help}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {help_success_text && <div className="mb-4 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm border border-green-200">{help_success_text}</div>}
            {help_error_text && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm border border-red-200">{help_error_text}</div>}
            <form className="space-y-4" onSubmit={handle_help_submit}>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="help_subject_farmer">{t.farmerDashboard.helpSubject}</label>
                <input id="help_subject_farmer" type="text" value={help_subject} onChange={handle_help_subject_change} disabled={is_sending_help}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.helpSubjectPlaceholder} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="help_message_farmer">{t.farmerDashboard.helpMessage}</label>
                <textarea id="help_message_farmer" rows={4} value={help_message} onChange={handle_help_message_change} disabled={is_sending_help}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50 resize-y"
                  placeholder={t.farmerDashboard.helpMessagePlaceholder}></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={close_help_modal} disabled={is_sending_help} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60 font-medium">{t.common.close}</button>
                <button type="submit" disabled={is_sending_help} className="px-4 py-2 text-sm bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] disabled:opacity-50 flex items-center font-medium">
                  {is_sending_help && <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>}
                  {is_sending_help ? t.common.sending : t.common.send}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CHANGE PASSWORD MODAL ─── */}
      {is_change_password_open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.changePassword}</h2>
              <button type="button" onClick={close_change_password_modal} className="text-gray-400 hover:text-gray-600" disabled={is_changing_password}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {cp_success_text && <div className="mb-4 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm border border-green-200">{cp_success_text}</div>}
            {cp_error_text && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm border border-red-200">{cp_error_text}</div>}
            <form className="space-y-4" onSubmit={handle_change_password_submit}>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="old_password_1_farmer">{t.farmerDashboard.oldPassword}</label>
                <input id="old_password_1_farmer" type="password" value={old_password_first} onChange={handle_old_password_first_change} disabled={is_changing_password}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.oldPasswordPlaceholder} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="old_password_2_farmer">{t.farmerDashboard.confirmOldPassword}</label>
                <input id="old_password_2_farmer" type="password" value={old_password_second} onChange={handle_old_password_second_change} disabled={is_changing_password}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.confirmOldPasswordPlaceholder} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="new_password_farmer">{t.farmerDashboard.newPassword}</label>
                <input id="new_password_farmer" type="password" value={new_password} onChange={handle_new_password_change} disabled={is_changing_password}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.newPasswordPlaceholder} />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={close_change_password_modal} disabled={is_changing_password} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60 font-medium">{t.common.cancel}</button>
                <button type="submit" disabled={is_changing_password} className="px-4 py-2 text-sm bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] disabled:opacity-50 flex items-center font-medium">
                  {is_changing_password && <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>}
                  {is_changing_password ? t.farmerDashboard.changing : t.farmerDashboard.changePasswordButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── SCAN MODAL ─── */}
      {is_scan_modal_open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.diagnosisResults || 'Diagnosis Results'}</h2>
              <button
                type="button"
                onClick={clear_diagnosis}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Preview */}
            {preview_url && (
              <img src={preview_url} alt="preview" className="w-full max-h-[300px] object-cover" />
            )}

            <div className="p-6">
              {/* Analyze Button */}
              {!diagnose_result && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handle_analyze_click}
                    disabled={is_uploading}
                    className="w-full py-3 bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 disabled:opacity-60 font-medium text-base"
                  >
                    {is_uploading ? t.farmerDashboard.analyzing : t.farmerDashboard.analyzeImage}
                  </button>
                </div>
              )}

              {/* Error */}
              {diagnose_error && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {diagnose_error}
                </div>
              )}

              {/* Results */}
              {diagnose_result && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{t.farmerDashboard.diagnosis}</div>
                      <p className="text-lg font-semibold text-gray-900 capitalize">{diagnose_result.diagnosis}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">{t.farmerDashboard.confidence}</div>
                      <p className="text-xl font-bold text-[#2D6A4F]">
                        {typeof diagnose_result.confidence === 'number' ? (diagnose_result.confidence * 100).toFixed(0) + '%' : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {Array.isArray(diagnose_result.recommendations) && diagnose_result.recommendations.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">{t.farmerDashboard.recommendations}</div>
                      <div className="space-y-2">
                        {diagnose_result.recommendations.map((r, i) => (
                          <p key={`rec-${i}-${r.substring(0, 10)}`} className="text-sm text-gray-700 leading-relaxed">{r}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(diagnose_result.alternatives) && diagnose_result.alternatives.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">{t.farmerDashboard.alternatives}</div>
                      <div className="flex gap-2 flex-wrap">
                        {diagnose_result.alternatives.map((a, i) => (
                          <span key={`alt-${a.label}-${i}`} className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 capitalize">
                            {a.label} {(a.confidence * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">{t.farmerDashboard.processingTime}: {diagnose_result.processing_ms}ms</p>
                </div>
              )}

              {/* Chat */}
              {is_chat_open && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">{t.farmerDashboard.aiAssistant}</p>
                  <div className="h-48 bg-gray-50 rounded-lg p-3 overflow-y-auto mb-3 space-y-2 border border-gray-200">
                    {chat_messages.map((msg, index) => (
                      <div key={`msg-${index}-${msg.content.substring(0, 20)}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                          msg.role === 'user' ? 'bg-[#2D6A4F] text-white' : 'bg-white border border-gray-200 text-gray-900'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  {chat_error_text && <div className="mb-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm border border-red-200">{chat_error_text}</div>}
                  <form className="flex gap-2" onSubmit={handle_chat_submit}>
                    <input type="text" value={chat_input} onChange={handle_chat_input_change} disabled={is_sending_chat}
                      className="flex-1 px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                      placeholder={t.farmerDashboard.chatPlaceholder} />
                    <button type="submit" disabled={is_sending_chat || !chat_input.trim()}
                      className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg font-medium hover:bg-[#1a4d35] disabled:opacity-50 transition-colors">
                      {is_sending_chat ? t.common.sending : t.common.send}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FarmerDashboard