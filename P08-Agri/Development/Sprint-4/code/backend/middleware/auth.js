/**
 * JWT auth middleware: requireAuth validates Bearer tokens and sets req.auth.
 * requireRole restricts routes to specific roles (farmer, inspector, admin).
 */
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  const token = authHeader.slice(7).trim()
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const userId = payload.sub || payload.userId || payload.id // backward-compatible: userId or id if older tokens lack sub
    const role = payload.role || null
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    req.auth = { userId, role }
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

// Audit trail for 403 role checks; response stays generic for clients.
function log_rbac_forbidden(req, reason) {
  const userId = req.auth && req.auth.userId ? String(req.auth.userId) : 'unknown'
  const role = req.auth && req.auth.role ? String(req.auth.role) : 'none'
  const path = (req.method && req.path) ? `${req.method} ${req.path}` : req.path || 'unknown'
  console.log('[RBAC] Forbidden', { userId, role, path, reason })
}

function requireRole(allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return (req, res, next) => next()
  }
  return (req, res, next) => {
    if (!req.auth || !req.auth.role) {
      log_rbac_forbidden(req, 'missing_auth_or_role')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (!allowedRoles.includes(req.auth.role)) {
      log_rbac_forbidden(req, 'role_not_allowed')
      return res.status(403).json({ message: 'Forbidden' })
    }
    next()
  }
}

module.exports = {
  requireAuth,
  requireRole
}
