/**
 * Farmer view of past diagnoses loaded from the history API.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { get_diagnosis_history } from '../../services/historyService'
import { useLanguage } from '../../contexts/LanguageContext'

function formatDate(dateString) {
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

function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

function getConfidenceBg(confidence) {
  if (confidence >= 0.8) return 'bg-green-100'
  if (confidence >= 0.6) return 'bg-yellow-100'
  return 'bg-red-100'
}

function DiagnosticHistory() {
  const navigate = useNavigate()
  const { t, language, setLanguage, direction } = useLanguage()
  const [diagnoses, setDiagnoses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  useEffect(() => {
    load_history()
  }, [])

  useEffect(() => {
    function handle_escape_key(event) {
      if (event.key === 'Escape' && isDetailModalOpen) {
        close_detail_modal()
      }
    }

    if (isDetailModalOpen) {
      document.addEventListener('keydown', handle_escape_key)
      return () => {
        document.removeEventListener('keydown', handle_escape_key)
      }
    }
  }, [isDetailModalOpen])

  async function load_history() {
    setIsLoading(true)
    setError('')
    try {
      const data = await get_diagnosis_history(50, 0)
      setDiagnoses(data.diagnoses || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load diagnosis history')
    } finally {
      setIsLoading(false)
    }
  }

  function handle_back_to_dashboard() {
    navigate('/farmer-dashboard')
  }

  function handle_view_details(diagnosis) {
    setSelectedDiagnosis(diagnosis)
    setIsDetailModalOpen(true)
  }

  function close_detail_modal() {
    setIsDetailModalOpen(false)
    setSelectedDiagnosis(null)
  }

  return (
    <div dir={direction} className="min-h-screen bg-[#f7fdf9]">
      {/* Header */}
      <header className="bg-[#2D6A4F] shadow-sm border-b border-[#1a4d35]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className={`flex ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'} items-center justify-between`}>
            <div className={`flex ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'} items-center gap-3`}>
              <button
                onClick={handle_back_to_dashboard}
                className="text-white hover:text-white/80 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">{t.diagnosticHistory.title}</h1>
            </div>
            <div className={`flex ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'} items-center gap-4`}>
              <button
                onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
                className="px-2 py-1 text-sm bg-white/20 text-white rounded-md hover:bg-white/30 transition-colors"
              >
                {language === 'en' ? '\u0627\u0631\u062f\u0648' : 'English'}
              </button>
              {total > 0 && <span className="text-sm text-white">{total} {t.diagnosticHistory.totalDiagnoses}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-emerald-800">{t.diagnosticHistory.yourHistory || 'Your Diagnostic History'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t.diagnosticHistory.viewPastDiagnoses || 'View and review past wheat diagnoses'}</p>
        </div>
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && diagnoses.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">{t.diagnosticHistory.noHistory}</h3>
            <p className="mt-1 text-sm text-gray-500">{t.diagnosticHistory.noHistoryMessage}</p>
            <button
              onClick={handle_back_to_dashboard}
              className="mt-4 px-4 py-2 bg-[#2D6A4F] text-white rounded-lg hover:bg-[#1a4d35] font-medium transition-colors"
            >
              {t.diagnosticHistory.goToDashboard}
            </button>
          </div>
        )}

        {!isLoading && !error && diagnoses.length > 0 && (
          <div className="space-y-4">
            {diagnoses.map((diagnosis) => {
              const isHighConfidence = diagnosis.confidence >= 0.7
              return (
                <button
                  key={diagnosis._id}
                  type="button"
                  className="w-full bg-white rounded-xl shadow-sm border border-[#2D6A4F] p-6 text-left hover:shadow-lg hover:border-[#1a4d35] hover:-translate-y-0.5 transition-all flex flex-row items-center gap-4 cursor-pointer"
                  onClick={() => handle_view_details(diagnosis)}
                >
                  <div className={`h-12 w-12 rounded-lg ${isHighConfidence ? 'bg-green-100' : 'bg-orange-100'} flex items-center justify-center flex-shrink-0`}>
                    {isHighConfidence ? (
                      <svg className="h-6 w-6 text-green-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">{diagnosis.diagnosis}</h3>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getConfidenceBg(diagnosis.confidence)} ${getConfidenceColor(diagnosis.confidence)}`}>
                        {(diagnosis.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(diagnosis.created_at)}</p>
                    {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                        {diagnosis.recommendations[0]}
                      </p>
                    )}
                  </div>
                  <svg className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedDiagnosis && (
        <div 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="diagnosis-detail-title"
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <button
              type="button"
              className="fixed inset-0 transition-opacity bg-black/40 backdrop-blur-sm border-0 p-0 cursor-pointer"
              onClick={close_detail_modal}
              aria-label="Close modal"
            ></button>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            {/* NOSONAR: stopPropagation prevents clicks inside modal from closing it - not making element interactive */}
            <div
              role="document"
              className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 id="diagnosis-detail-title" className="text-2xl font-bold text-gray-900">{t.diagnosticHistory.diagnosisDetails}</h3>
                  <button
                    onClick={close_detail_modal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-1">{t.diagnosticHistory.diagnosis}</div>
                    <p className="text-lg font-semibold text-gray-900">{selectedDiagnosis.diagnosis}</p>
                  </div>

                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-1">{t.diagnosticHistory.confidence}</div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-[#2D6A4F]"
                          style={{ width: `${selectedDiagnosis.confidence * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-[#2D6A4F]">
                        {(selectedDiagnosis.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-1">{t.diagnosticHistory.date}</div>
                    <p className="text-gray-900">{formatDate(selectedDiagnosis.created_at)}</p>
                  </div>

                  {selectedDiagnosis.alternatives && selectedDiagnosis.alternatives.length > 0 && (
                    <div>
                      <div className="block text-sm font-medium text-gray-700 mb-2">{t.diagnosticHistory.alternativeDiagnoses}</div>
                      <div className="space-y-2">
                        {selectedDiagnosis.alternatives.map((alt, index) => (
                          <div key={alt.label || `alt-${index}`} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-gray-900">{alt.label}</span>
                            <span className="text-sm text-gray-600">{(alt.confidence * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDiagnosis.recommendations && selectedDiagnosis.recommendations.length > 0 && (
                    <div>
                      <div className="block text-sm font-medium text-gray-700 mb-2">{t.diagnosticHistory.recommendations}</div>
                      <ul className="space-y-2">
                        {selectedDiagnosis.recommendations.map((rec, index) => (
                          <li key={`rec-${index}-${rec.substring(0, 20)}`} className="flex items-start">
                            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-900">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedDiagnosis.processing_ms && (
                    <div className="text-xs text-gray-500">
                      {t.diagnosticHistory.processingTime}: {selectedDiagnosis.processing_ms}ms
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={close_detail_modal}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-[#2D6A4F] text-base font-medium text-white hover:bg-[#1a4d35] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                >
                  {t.diagnosticHistory.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DiagnosticHistory