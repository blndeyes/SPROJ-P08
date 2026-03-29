import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { LanguageProvider } from './contexts/LanguageContext'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import VerifyOtp from './pages/auth/VerifyOtp'
import Dashboard from './pages/dashboard/Dashboard'
import FarmerDashboard from './pages/dashboard/FarmerDashboard'
import DiagnosticHistory from './pages/dashboard/DiagnosticHistory'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import './App.css'

/**
 * App shell: routes and guards so each role only reaches its dashboards; bad or missing role clears storage and sends users to login.
 */
function App() {
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null
  }

  const VALID_ROLES = ['farmer', 'inspector', 'admin']

  const getUserRole = () => {
    const userJson = localStorage.getItem('user')
    if (!userJson) return null
    try {
      const user = JSON.parse(userJson)
      const role = user?.role || null
      return VALID_ROLES.includes(role) ? role : null
    } catch {
      return null
    }
  }

  const clearSession = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const redirectToRoleDashboard = (role) => {
    if (role === 'farmer') return '/farmer-dashboard'
    if (role === 'admin') return '/admin-dashboard'
    if (role === 'inspector') return '/inspector-dashboard'
    return null
  }

  // Enforces login and allowed role; unknown or mismatched role clears localStorage, then redirects.
  const PrivateRoute = ({ children, allowedRoles }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" replace />
    }

    const userRole = getUserRole()
    if (userRole === null) {
      clearSession()
      return <Navigate to="/login" replace />
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      const target = redirectToRoleDashboard(userRole)
      if (target) return <Navigate to={target} replace />
      clearSession()
      return <Navigate to="/login" replace />
    }

    return children
  }

  const DashboardRedirect = () => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" replace />
    }
    const userRole = getUserRole()
    if (userRole === null) {
      clearSession()
      return <Navigate to="/login" replace />
    }
    const target = redirectToRoleDashboard(userRole)
    if (target) return <Navigate to={target} replace />
    clearSession()
    return <Navigate to="/login" replace />
  }

  const CatchAllRedirect = () => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" replace />
    }
    const userRole = getUserRole()
    if (userRole === null) {
      clearSession()
      return <Navigate to="/login" replace />
    }
    const target = redirectToRoleDashboard(userRole)
    return <Navigate to={target || '/login'} replace />
  }

  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || ''
  const routes = (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route
          path="/farmer-dashboard"
          element={
            <PrivateRoute allowedRoles={['farmer']}>
              <FarmerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/diagnostic-history"
          element={
            <PrivateRoute allowedRoles={['farmer']}>
              <DiagnosticHistory />
            </PrivateRoute>
          }
        />
        <Route
          path="/inspector-dashboard"
          element={
            <PrivateRoute allowedRoles={['inspector']}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </Router>
  )

  return (
    <LanguageProvider>
      {googleClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>
          {routes}
        </GoogleOAuthProvider>
      ) : (
        routes
      )}
    </LanguageProvider>
  )
}

export default App
