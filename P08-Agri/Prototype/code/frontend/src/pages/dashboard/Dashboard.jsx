import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetch_weather_by_coords } from '../../services/weatherService'
import { diagnose_image } from '../../services/diagnoseService'

function Dashboard() {
  const navigate = useNavigate()
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

  function handle_logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  function get_browser_location() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not available'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latitude = pos.coords.latitude
          const longitude = pos.coords.longitude
          resolve({ latitude, longitude })
        },
        () => {
          reject(new Error('Location permission denied or unavailable'))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      )
    })
  }

  async function handle_get_weather() {
    if (is_getting_weather) {
      return
    }
    set_weather_error('')
    set_is_getting_weather(true)
    set_weather_data(null)
    try {
      const { latitude, longitude } = await get_browser_location()
      const data = await fetch_weather_by_coords(latitude, longitude)
      set_weather_data(data)
    } catch (err) {
      const msg = typeof err === 'string' ? err : err && err.message ? err.message : 'Failed to get weather'
      set_weather_error(msg)
    } finally {
      set_is_getting_weather(false)
    }
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
    try {
      const data = await diagnose_image(selected_file)
      set_diagnose_result(data)
    } catch (err) {
      const message = err && err.message ? err.message : 'Analysis failed'
      set_diagnose_error(message)
    } finally {
      set_is_uploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">AgriQual Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handle_get_weather}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-60"
              disabled={is_getting_weather}
            >
              {is_getting_weather ? 'Getting weather...' : 'Get Weather update'}
            </button>
            <input ref={file_input_ref} type="file" accept="image/*" className="hidden" onChange={handle_file_change} />
            <button
              type="button"
              onClick={handle_click_upload_button}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              Upload a Picture
            </button>
            <span className="text-sm text-gray-600">
              Welcome, <span className="font-medium">{user.name || 'User'}</span>
            </span>
            <button
              onClick={handle_logout}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {weather_error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {weather_error}
          </div>
        )}

        {weather_data && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Weather Update</h2>
              <p className="text-sm text-gray-600">
                {weather_data.city} • {weather_data.current.temperature_c}°C • Wind {weather_data.current.wind_speed_kmh} km/h
              </p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Max Temp</p>
                <p className="text-2xl font-semibold text-gray-900">{weather_data.today.tmax_c}°C</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Min Temp</p>
                <p className="text-2xl font-semibold text-gray-900">{weather_data.today.tmin_c}°C</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Precipitation</p>
                <p className="text-2xl font-semibold text-gray-900">{weather_data.today.precipitation_mm} mm</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">UV Index</p>
                <p className="text-2xl font-semibold text-gray-900">{weather_data.today.uv_index_max}</p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-md font-semibold text-gray-900 mb-3">Farmer Advice</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                {weather_data.advice.map((item, idx) => (
                  <li key={idx} className="text-sm">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {selected_file && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Image Diagnosis</h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handle_analyze_click}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-60"
                  disabled={is_uploading}
                >
                  {is_uploading ? 'Analyzing...' : 'Analyze'}
                </button>
                <button
                  type="button"
                  onClick={() => { set_selected_file(null); set_preview_url(''); set_diagnose_result(null); set_diagnose_error(''); }}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {preview_url && <img src={preview_url} alt="preview" className="w-full rounded-lg shadow" />}
              </div>
              <div>
                {diagnose_error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {diagnose_error}
                  </div>
                )}
                {diagnose_result && (
                  <div className="space-y-3">
                    <div className="text-lg">Diagnosis: <span className="font-semibold capitalize">{diagnose_result.diagnosis}</span></div>
                    <div>Confidence: {(diagnose_result.confidence * 100).toFixed(1)}%</div>
                    {Array.isArray(diagnose_result.recommendations) && diagnose_result.recommendations.length > 0 && (
                      <div>
                        <div className="font-medium">Recommendations</div>
                        <ul className="list-disc pl-6">
                          {diagnose_result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(diagnose_result.alternatives) && diagnose_result.alternatives.length > 0 && (
                      <div>
                        <div className="font-medium">Alternatives</div>
                        <ul className="list-disc pl-6">
                          {diagnose_result.alternatives.map((a, i) => (
                            <li key={i} className="capitalize">{a.label} • {(a.confidence * 100).toFixed(1)}%</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-sm text-gray-600">Processing time: {diagnose_result.processing_ms} ms</div>
                  </div>
                )}
                {!diagnose_result && !diagnose_error && (
                  <p className="text-sm text-gray-600">Click Analyze to run the image through the model.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Inspections</p>
                <p className="text-2xl font-semibold text-gray-900">24</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">8</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Farms Registered</p>
                <p className="text-2xl font-semibold text-gray-900">12</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Inspection completed for Farm #A123</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">Passed</span>
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">New farm registration pending review</p>
                  <p className="text-xs text-gray-500">5 hours ago</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded">Pending</span>
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Report generated for Q3 2024</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded">Review</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
