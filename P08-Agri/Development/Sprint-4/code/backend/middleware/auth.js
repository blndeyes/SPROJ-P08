/**
 * Role-based access control (RBAC) middleware.
 * JWT payload from auth.js createTokenForUser: { sub: userId, role: 'farmer'|'inspector'|'admin' }
 *
 * STRIDE: Spoofing/Tampering (JWT verify); Repudiation (audit log on 403);
 * Information disclosure (generic 401/403); Elevation of privilege (requireRole).
 */
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

/**
 * Require valid JWT. Sets req.auth = { userId, role }.
 * Returns 401 if missing or invalid token.
 * STRIDE: No token or payload is logged (Information disclosure).
 */
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
    const userId = payload.sub || payload.userId || payload.id
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

/**
 * STRIDE Repudiation: log role-denied access (no token, no required-role leaked).
 */
function log_rbac_forbidden(req, reason) {
  const userId = req.auth && req.auth.userId ? String(req.auth.userId) : 'unknown'
  const role = req.auth && req.auth.role ? String(req.auth.role) : 'none'
  const path = (req.method && req.path) ? `${req.method} ${req.path}` : req.path || 'unknown'
  console.log('[RBAC] Forbidden', { userId, role, path, reason })
}

/**
 * Require that the authenticated user has one of the allowed roles.
 * Use after requireAuth. Returns 403 if role not allowed.
 * STRIDE Repudiation: logs 403 with userId, role, path (no token).
 * @param {string[]} allowedRoles - e.g. ['farmer'], ['admin'], ['farmer','inspector']
 */
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
