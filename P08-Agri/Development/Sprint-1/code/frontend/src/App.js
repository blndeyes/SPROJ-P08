import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import VerifyOtp from './pages/auth/VerifyOtp'
import Dashboard from './pages/dashboard/Dashboard'
import FarmerDashboard from './pages/dashboard/FarmerDashboard'
import DiagnosticHistory from './pages/dashboard/DiagnosticHistory'
import './App.css'

function App() {
  // check if a user token exists
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null
  }

  // read role from stored user
  const getUserRole = () => {
    const userJson = localStorage.getItem('user')
    if (!userJson) {
      return null
    }
    try {
      const user = JSON.parse(userJson)
      return user.role || null
    } catch {
      return null
    }
  }

  // protect routes and optionally restrict by role
  const PrivateRoute = ({ children, allowedRoles }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" />
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = getUserRole()
      if (!allowedRoles.includes(userRole)) {
        // redirect user to their home dashboard based on role
        if (userRole === 'farmer') {
          return <Navigate to="/farmer-dashboard" />
        } else if (userRole === 'inspector') {
          return <Navigate to="/inspector-dashboard" />
        } else {
          return <Navigate to="/dashboard" />
        }
      }
    }

    return children
  }

  // send user to the right dashboard url
  const DashboardRedirect = () => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" />
    }

    const userRole = getUserRole()
    if (userRole === 'farmer') {
      return <Navigate to="/farmer-dashboard" />
    } else if (userRole === 'inspector') {
      return <Navigate to="/inspector-dashboard" />
    } else {
      return <Navigate to="/dashboard" />
    }
  }

  return (
    <Router>
      <Routes>
        {/* public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* role aware redirect */}
        <Route path="/dashboard" element={<DashboardRedirect />} />
        {/* farmer only routes */}
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
        {/* inspector or admin routes */}
        <Route
          path="/inspector-dashboard"
          element={
            <PrivateRoute allowedRoles={['inspector', 'admin']}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        {/* default route */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  )
}

export default App
