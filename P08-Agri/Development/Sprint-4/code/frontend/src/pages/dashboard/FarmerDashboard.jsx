import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetch_weather_by_coords } from '../../services/weatherService'
import { diagnose_image } from '../../services/diagnoseService'
import { send_complaint } from '../../services/helpService'
import { changePassword } from '../../services/authService'
import { send_chat_message } from '../../services/chatService'
import { get_fields, create_field, update_field, delete_field, link_diagnosis_to_field, save_and_link_diagnosis_to_field } from '../../services/fieldService'
import { useLanguage } from '../../contexts/LanguageContext'

function build_chat_intro_message(diagnose_result, t) {
  const confidence =
    typeof diagnose_result.confidence === 'number'
      ? (diagnose_result.confidence * 100).toFixed(1)
      : 'unknown'

  const confidence_text =
    confidence !== 'unknown'
      ? `${t.farmerDashboard.withConfidence} ${confidence}${t.farmerDashboard.confidencePercent} `
      : ''

  return {
    role: 'assistant',
    content: `${t.farmerDashboard.analyzedWheatImage} "${diagnose_result.diagnosis}" ${confidence_text}${t.farmerDashboard.askFollowUp}`
  }
}

function validate_help_form(subject, message, t) {
  const trimmed_subject = subject.trim()
  const trimmed_message = message.trim()

  if (!trimmed_subject || !trimmed_message) {
    return { isValid: false, error: t.farmerDashboard.helpFieldsRequired }
  }

  return { isValid: true, subject: trimmed_subject, message: trimmed_message }
}

function validate_password_change(old_1, old_2, new_pass, t) {
  const trimmed_old_1 = old_1.trim()
  const trimmed_old_2 = old_2.trim()
  const trimmed_new = new_pass.trim()

  if (!trimmed_old_1 || !trimmed_old_2 || !trimmed_new) {
    return { isValid: false, error: t.farmerDashboard.passwordFieldsRequired }
  }

  if (trimmed_old_1 !== trimmed_old_2) {
    return { isValid: false, error: t.farmerDashboard.oldPasswordMismatch }
  }

  if (trimmed_new.length < 6) {
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
  const [is_weather_modal_open, set_is_weather_modal_open] = useState(false)

  const [fields, set_fields] = useState([])
  const [fields_loading, set_fields_loading] = useState(false)
  const [fields_error, set_fields_error] = useState('')
  const [is_field_modal_open, set_is_field_modal_open] = useState(false)
  const [editing_field, set_editing_field] = useState(null)
  const [field_form, set_field_form] = useState({ name: '', area: '', location: '', wheat_variety: '', sowing_date: '' })
  const [field_form_error, set_field_form_error] = useState('')
  const [is_saving_field, set_is_saving_field] = useState(false)
  const [assign_field_id, set_assign_field_id] = useState('')
  const [is_linking, set_is_linking] = useState(false)
  const [link_success, set_link_success] = useState(false)

  async function load_fields() {
    set_fields_loading(true)
    set_fields_error('')
    try {
      const list = await get_fields()
      set_fields(list)
    } catch (err) {
      set_fields_error(err && err.message ? err.message : 'Failed to load fields')
    } finally {
      set_fields_loading(false)
    }
  }

  /* Auto-fetch weather on mount and when language changes (so advice is in the right language) */
  useEffect(() => {
    handle_get_weather()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  useEffect(() => {
    load_fields()
  }, [])

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
    if (is_getting_weather) {
      return
    }

    set_is_getting_weather(true)
    set_weather_error('')
    set_weather_data(null)

    try {
      const coords = await get_browser_location()
      const data = await fetch_weather_by_coords(coords.latitude, coords.longitude, language)
      set_weather_data(data)
    } catch (error) {
      set_weather_error(error && error.message ? error.message : t.farmerDashboard.weatherFetchFailed)
    } finally {
      set_is_getting_weather(false)
    }
  }

  function close_weather_modal() {
    set_is_weather_modal_open(false)
  }

  function handle_click_upload_button() {
    if (file_input_ref.current) {
      file_input_ref.current.click()
    }
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
    if (!selected_file) {
      set_diagnose_error('Please select an image')
      return
    }

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
      const intro_message = build_chat_intro_message(diagnose_result, t)
      set_is_chat_open(true)
      set_chat_messages([intro_message])
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
    if (is_sending_help) {
      return
    }

    set_is_help_open(false)
  }

  function handle_help_subject_change(e) {
    set_help_subject(e.target.value)

    if (help_error_text) {
      set_help_error_text('')
    }

    if (help_success_text) {
      set_help_success_text('')
    }
  }

  function handle_help_message_change(e) {
    set_help_message(e.target.value)

    if (help_error_text) {
      set_help_error_text('')
    }

    if (help_success_text) {
      set_help_success_text('')
    }
  }

  async function handle_help_submit(e) {
    e.preventDefault()

    if (is_sending_help) {
      return
    }

    const validation = validate_help_form(help_subject, help_message, t)

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
    } finally {
      set_is_sending_help(false)
    }
  }

  function toggle_profile_menu() {
    set_is_profile_menu_open((prev) => !prev)
  }

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
    if (is_changing_password) {
      return
    }

    set_is_change_password_open(false)
  }

  function handle_old_password_first_change(e) {
    set_old_password_first(e.target.value)

    if (cp_error_text) {
      set_cp_error_text('')
    }

    if (cp_success_text) {
      set_cp_success_text('')
    }
  }

  function handle_old_password_second_change(e) {
    set_old_password_second(e.target.value)

    if (cp_error_text) {
      set_cp_error_text('')
    }

    if (cp_success_text) {
      set_cp_success_text('')
    }
  }

  function handle_new_password_change(e) {
    set_new_password(e.target.value)

    if (cp_error_text) {
      set_cp_error_text('')
    }

    if (cp_success_text) {
      set_cp_success_text('')
    }
  }

  async function handle_change_password_submit(e) {
    e.preventDefault()

    if (is_changing_password) {
      return
    }

    const validation = validate_password_change(old_password_first, old_password_second, new_password, t)

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

  function handle_chat_input_change(e) {
    set_chat_input(e.target.value)

    if (chat_error_text) {
      set_chat_error_text('')
    }
  }

  async function handle_chat_submit(e) {
    e.preventDefault()

    if (is_sending_chat || !chat_input.trim()) {
      return
    }

    const user_message = chat_input.trim()
    const updated_messages = [...chat_messages, { role: 'user', content: user_message }]

    set_chat_messages(updated_messages)
    set_chat_input('')
    set_is_sending_chat(true)
    set_chat_error_text('')

    try {
      const response = await send_chat_message({
        diagnosis: diagnose_result,
        messages: updated_messages,
        language
      })

      set_chat_messages((prev) => [
        ...prev,
        { role: 'assistant', content: response.content }
      ])
    } catch (error) {
      set_chat_error_text(error && error.message ? error.message : t.farmerDashboard.chatSendFailed)
    } finally {
      set_is_sending_chat(false)
    }
  }

  function clear_diagnosis() {
    set_selected_file(null)
    set_preview_url('')
    set_diagnose_result(null)
    set_diagnose_error('')
    set_is_chat_open(false)
    set_chat_messages([])
    set_chat_input('')
    set_chat_error_text('')
    set_is_scan_modal_open(false)
    set_assign_field_id('')
    set_link_success(false)

    if (file_input_ref.current) {
      file_input_ref.current.value = ''
    }
  }

  function open_add_field_modal() {
    set_editing_field(null)
    set_field_form({ name: '', area: '', location: '', wheat_variety: '', sowing_date: '' })
    set_field_form_error('')
    set_is_field_modal_open(true)
  }

  function open_edit_field_modal(field) {
    set_editing_field(field)
    set_field_form({
      name: field.name || '',
      area: field.area || '',
      location: field.location || '',
      wheat_variety: field.wheat_variety || '',
      sowing_date: field.sowing_date || ''
    })
    set_field_form_error('')
    set_is_field_modal_open(true)
  }

  function close_field_modal() {
    set_is_field_modal_open(false)
    set_editing_field(null)
    set_field_form_error('')
  }

  async function handle_field_submit(e) {
    e.preventDefault()
    if (!field_form.name.trim()) {
      set_field_form_error(t.farmerDashboard.fieldNameRequired || 'Field name is required')
      return
    }
    set_is_saving_field(true)
    set_field_form_error('')
    try {
      if (editing_field) {
        await update_field(editing_field._id, field_form)
      } else {
        await create_field(field_form)
      }
      await load_fields()
      close_field_modal()
    } catch (err) {
      set_field_form_error(err && err.message ? err.message : 'Failed to save field')
    } finally {
      set_is_saving_field(false)
    }
  }

  async function handle_delete_field(field) {
    if (!window.confirm(t.farmerDashboard.deleteFieldConfirm || `Delete "${field.name}"?`)) return
    try {
      await delete_field(field._id)
      await load_fields()
    } catch (err) {
      set_fields_error(err && err.message ? err.message : 'Failed to delete field')
    }
  }

  async function handle_assign_to_field() {
    if (!diagnose_result || !assign_field_id) return
    set_is_linking(true)
    set_link_success(false)
    try {
      if (diagnose_result.diagnosisId) {
        await link_diagnosis_to_field(diagnose_result.diagnosisId, assign_field_id)
      } else {
        await save_and_link_diagnosis_to_field(diagnose_result, assign_field_id)
      }
      set_link_success(true)
      await load_fields()
    } catch (err) {
      set_field_form_error(err && err.message ? err.message : 'Failed to link to field')
    } finally {
      set_is_linking(false)
    }
  }

  const fields_display = fields.map((f) => ({
    ...f,
    name: f.name || 'Unnamed',
    status: f.status || 'unknown',
    area: f.area || '—',
    variety: f.wheat_variety || '—',
    sowing: f.sowing_date || '—',
    location: f.location || '—',
    health: typeof f.health === 'number' ? f.health : null
  }))

  const user_name = user?.name || 'Farmer'
  const user_initial = (user_name.charAt(0) || 'F').toUpperCase()

  const scan_history = [
    { status: 'healthy' }, { status: 'healthy' }, { status: 'issue' },
    { status: 'healthy' }, { status: 'healthy' }, { status: 'healthy' },
    { status: 'issue' }, { status: 'healthy' }, { status: 'healthy' },
    { status: 'issue' }, { status: 'healthy' }, { status: 'healthy' }
  ]

  return (
    <div dir={direction} className="min-h-screen bg-[#f7fdf9]">
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
                  <span className="text-[#2D6A4F] font-semibold text-sm">{user_initial}</span>
                </div>
                <span className="text-sm font-medium text-white hidden sm:inline">{user_name}</span>
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-emerald-800">
            {t.farmerDashboard.welcome}, {user_name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.farmerDashboard.manageFarmsSubtitle || 'Manage your fields, scan crops, and track your harvest health.'}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          <button
            type="button"
            onClick={handle_click_upload_button}
            className="lg:col-span-3 bg-white rounded-2xl border border-[#D5DDD0] p-8 flex flex-col items-center justify-center text-center min-h-[320px] hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="h-16 w-16 rounded-2xl bg-[#EDF2E8] flex items-center justify-center mb-4 group-hover:bg-[#D5DDD0] transition-colors">
              <svg className="h-8 w-8 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.uploadImage}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.farmerDashboard.dropImageText || 'Drop an image or click to browse'}</p>
          </button>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-[#D5DDD0] p-5 flex-1">
              {is_getting_weather && !weather_data && (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D6A4F]"></div>
                </div>
              )}

              {weather_error && !weather_data && (
                <div className="text-center py-4">
                  <p className="text-sm text-red-600 mb-3">{weather_error}</p>
                  <button
                    type="button"
                    onClick={handle_get_weather}
                    disabled={is_getting_weather}
                    className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d35]"
                  >
                    {t.farmerDashboard.getWeather || 'Try Again'}
                  </button>
                </div>
              )}

              {weather_data && (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{t.farmerDashboard.currentWeather}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{weather_data.city}</p>
                    </div>
                    <span className="text-3xl font-bold text-gray-900">{weather_data.current.temperature_c}°</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{t.farmerDashboard.windSpeed || 'Windspeed'}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{weather_data.current.wind_speed_kmh} <span className="text-xs font-normal text-gray-500">km/h</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{t.farmerDashboard.rain || 'Rain'}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{weather_data.today.precipitation_mm || 0} <span className="text-xs font-normal text-gray-500">mm</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{t.farmerDashboard.uvIndex || 'UV'}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{weather_data.today.uv_index_max}</p>
                    </div>
                  </div>
                  {weather_data.advice && weather_data.advice.length > 0 && (
                    <div className="bg-[#FEF9E7] rounded-lg p-3">
                      <p className="text-xs font-bold text-[#92400E] mb-0.5">{t.farmerDashboard.tip || 'Tip'}</p>
                      <p className="text-xs text-[#78350F] leading-relaxed">{weather_data.advice[0]}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => set_is_weather_modal_open(true)}
                    className="mt-3 w-full py-2.5 px-3 rounded-lg bg-[#2D6A4F] text-white text-sm font-medium hover:bg-[#1a4d35] transition-colors"
                  >
                    {t.farmerDashboard.viewWeatherAdvisory || 'View weather advisory'}
                  </button>
                </>
              )}

              {!weather_data && !weather_error && !is_getting_weather && (
                <button type="button" onClick={handle_get_weather} className="w-full text-center py-6">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">{t.farmerDashboard.currentWeather}</p>
                  <p className="text-sm text-[#2D6A4F] font-medium">{t.farmerDashboard.getWeather}</p>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => navigate('/diagnostic-history')}
                className="bg-white rounded-2xl border border-[#D5DDD0] p-4 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="h-9 w-9 rounded-lg bg-[#EDF2E8] flex items-center justify-center mb-3">
                  <svg className="h-4.5 w-4.5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{t.farmerDashboard.viewHistory}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t.farmerDashboard.pastScans}</p>
              </button>
              <button
                type="button"
                onClick={open_help_modal}
                className="bg-white rounded-2xl border border-[#D5DDD0] p-4 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="h-9 w-9 rounded-lg bg-[#FEF3E0] flex items-center justify-center mb-3">
                  <svg className="h-4.5 w-4.5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{t.farmerDashboard.needHelp}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t.farmerDashboard.contactSupport}</p>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#D5DDD0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D5DDD0] flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{t.farmerDashboard.myWheatFields}</h2>
              <button type="button" onClick={open_add_field_modal} className="text-sm text-[#2D6A4F] font-medium hover:underline">
                + {t.farmerDashboard.addNewField}
              </button>
            </div>
            {fields_error && <div className="px-6 py-2 text-sm text-red-600">{fields_error}</div>}
            {fields_loading && (
              <div className="px-6 py-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D6A4F]" />
              </div>
            )}
            {!fields_loading && fields_display.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                {t.farmerDashboard.noFieldsFound || 'No fields found. Add a field to get started.'}
              </div>
            )}
            <div className="px-6 divide-y divide-gray-100">
              {fields_display.map((field) => {
                const is_alert = field.status === 'attention'
                const is_issue = field.status === 'issue'

                return (
                  <div key={field._id} className="py-4 first:pt-4 last:pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{field.name}</span>
                        {is_issue ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-800">
                            {t.farmerDashboard.needsAttention}
                          </span>
                        ) : is_alert ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-800">
                            {t.farmerDashboard.needsAttention}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-green-100 text-green-700">
                            {t.farmerDashboard.healthy}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => open_edit_field_modal(field)} className="text-xs text-[#2D6A4F] font-medium hover:underline">
                          {t.farmerDashboard.edit}
                        </button>
                        <button type="button" onClick={() => handle_delete_field(field)} className="text-xs text-red-600 font-medium hover:underline">
                          {t.farmerDashboard.delete || 'Delete'}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 block mb-1">{field.area} · {field.variety}</span>
                    <div className="w-full h-2 rounded-full bg-gray-100 mt-1">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${field.health == null ? 'bg-gray-300' : is_issue ? 'bg-red-500' : is_alert ? 'bg-[#F59E0B]' : 'bg-[#2D6A4F]'}`}
                        style={{ width: `${field.health != null ? field.health : 0}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#D5DDD0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D5DDD0] flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{t.farmerDashboard.recentScans || 'Recent Scans'}</h2>
              <button type="button" onClick={() => navigate('/diagnostic-history')} className="text-sm text-[#2D6A4F] font-medium hover:underline">
                {t.farmerDashboard.viewAll || 'View all'}
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-6 gap-2">
                {scan_history.map((scan, i) => (
                  <div
                    key={`scan-${i}`}
                    className={`aspect-square rounded-lg ${scan.status === 'issue' ? 'bg-red-200' : 'bg-green-100'}`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

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
                <input
                  id="help_subject_farmer"
                  type="text"
                  value={help_subject}
                  onChange={handle_help_subject_change}
                  disabled={is_sending_help}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.helpSubjectPlaceholder}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="help_message_farmer">{t.farmerDashboard.helpMessage}</label>
                <textarea
                  id="help_message_farmer"
                  rows={4}
                  value={help_message}
                  onChange={handle_help_message_change}
                  disabled={is_sending_help}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50 resize-y"
                  placeholder={t.farmerDashboard.helpMessagePlaceholder}
                ></textarea>
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
                <input
                  id="old_password_1_farmer"
                  type="password"
                  value={old_password_first}
                  onChange={handle_old_password_first_change}
                  disabled={is_changing_password}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.oldPasswordPlaceholder}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="old_password_2_farmer">{t.farmerDashboard.confirmOldPassword}</label>
                <input
                  id="old_password_2_farmer"
                  type="password"
                  value={old_password_second}
                  onChange={handle_old_password_second_change}
                  disabled={is_changing_password}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.confirmOldPasswordPlaceholder}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700" htmlFor="new_password_farmer">{t.farmerDashboard.newPassword}</label>
                <input
                  id="new_password_farmer"
                  type="password"
                  value={new_password}
                  onChange={handle_new_password_change}
                  disabled={is_changing_password}
                  className="mt-1 w-full px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                  placeholder={t.farmerDashboard.newPasswordPlaceholder}
                />
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

      {is_field_modal_open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editing_field ? (t.farmerDashboard.editField || 'Edit field') : (t.farmerDashboard.addNewField || 'Add new field')}</h2>
              <button type="button" onClick={close_field_modal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {field_form_error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{field_form_error}</div>}
            <form onSubmit={handle_field_submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.farmerDashboard.fieldName || 'Field name'} *</label>
                <input
                  type="text"
                  value={field_form.name}
                  onChange={(e) => set_field_form((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                  placeholder={t.farmerDashboard.fieldNamePlaceholder || 'e.g. North Field'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.farmerDashboard.area}</label>
                <input
                  type="text"
                  value={field_form.area}
                  onChange={(e) => set_field_form((f) => ({ ...f, area: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                  placeholder={t.farmerDashboard.areaPlaceholder || 'e.g. 5 acres'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.farmerDashboard.location}</label>
                <input
                  type="text"
                  value={field_form.location}
                  onChange={(e) => set_field_form((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                  placeholder={t.farmerDashboard.locationPlaceholder || 'e.g. Lahore, Punjab'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.farmerDashboard.variety}</label>
                <input
                  type="text"
                  value={field_form.wheat_variety}
                  onChange={(e) => set_field_form((f) => ({ ...f, wheat_variety: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                  placeholder={t.farmerDashboard.varietyPlaceholder || 'e.g. Punjab-11'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.farmerDashboard.sowingDate}</label>
                <input
                  type="text"
                  value={field_form.sowing_date}
                  onChange={(e) => set_field_form((f) => ({ ...f, sowing_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                  placeholder={t.farmerDashboard.sowingDatePlaceholder || 'e.g. Oct 2024'}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={close_field_modal} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">{t.common.cancel}</button>
                <button type="submit" disabled={is_saving_field} className="px-4 py-2 text-sm bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] disabled:opacity-50 font-medium">
                  {is_saving_field ? (t.common.saving || 'Saving...') : (t.common.save || 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {is_scan_modal_open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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

            {preview_url && (
              <img src={preview_url} alt="preview" className="w-full max-h-[300px] object-cover" />
            )}

            <div className="p-6">
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

              {diagnose_error && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {diagnose_error}
                </div>
              )}

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

                  {diagnose_result && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">{t.farmerDashboard.assignToField || 'Add this diagnosis to a field'}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={assign_field_id}
                          onChange={(e) => set_assign_field_id(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F]"
                        >
                          <option value="">— {t.farmerDashboard.selectField || 'Select field'} —</option>
                          {fields.map((f) => (
                            <option key={f._id} value={f._id}>{f.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handle_assign_to_field}
                          disabled={!assign_field_id || is_linking}
                          className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] disabled:opacity-50 text-sm font-medium"
                        >
                          {is_linking ? (t.common.sending || 'Linking...') : (t.farmerDashboard.addToField || 'Add to field')}
                        </button>
                        {link_success && <span className="text-sm text-green-600">{t.farmerDashboard.linkedToField || 'Linked! Field health updated.'}</span>}
                      </div>
                      {fields.length === 0 && <p className="text-xs text-gray-500 mt-1">{t.farmerDashboard.addFieldFirst || 'Add a field from the dashboard to link diagnoses.'}</p>}
                    </div>
                  )}

                  <p className="text-xs text-gray-500">{t.farmerDashboard.processingTime}: {diagnose_result.processing_ms}ms</p>
                </div>
              )}

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
                    <input
                      type="text"
                      value={chat_input}
                      onChange={handle_chat_input_change}
                      disabled={is_sending_chat}
                      className="flex-1 px-3 py-2 border border-[#2D6A4F] rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:border-[#2D6A4F] disabled:bg-gray-50"
                      placeholder={t.farmerDashboard.chatPlaceholder}
                    />
                    <button
                      type="submit"
                      disabled={is_sending_chat || !chat_input.trim()}
                      className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg font-medium hover:bg-[#1a4d35] disabled:opacity-50 transition-colors"
                    >
                      {is_sending_chat ? t.common.sending : t.common.send}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {is_weather_modal_open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t.farmerDashboard.currentWeather}</h2>
              <button
                type="button"
                onClick={close_weather_modal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {is_getting_weather && (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2D6A4F]"></div>
                </div>
              )}

              {weather_error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">
                  {weather_error}
                </div>
              )}

              {weather_data && (
                <>
                  <div className="mb-6">
                    <p className="text-sm text-gray-500">{weather_data.city}</p>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-5xl font-bold text-gray-900">{weather_data.current.temperature_c}°</span>
                      <span className="text-sm text-gray-500">{weather_data.current.condition ?? '—'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">{t.farmerDashboard.windSpeed || 'Wind'}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{weather_data.current.wind_speed_kmh} <span className="text-xs font-normal text-gray-500">km/h</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">{t.farmerDashboard.humidity || 'Humidity'}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{weather_data.current.humidity ?? '—'}<span className="text-xs font-normal text-gray-500">%</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">{t.farmerDashboard.uvIndex || 'UV'}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{weather_data.today.uv_index_max}</p>
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
                </>
              )}

              {weather_error && !is_getting_weather && (
                <button
                  type="button"
                  onClick={handle_get_weather}
                  className="w-full py-2 bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] font-medium text-sm"
                >
                  {t.farmerDashboard.getWeather || 'Try Again'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FarmerDashboard