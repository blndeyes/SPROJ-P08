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
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null
  }

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

  const PrivateRoute = ({ children, allowedRoles }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" />
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = getUserRole()
      if (!allowedRoles.includes(userRole)) {
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
            <PrivateRoute allowedRoles={['inspector', 'admin']}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  )
}

export default App
