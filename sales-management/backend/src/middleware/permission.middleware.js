const { prisma } = require('../config/database')
const { error } = require('../utils/response')

/**
 * Dynamic RBAC permission check
 * @param {string} module - e.g. 'products'
 * @param {string} action - e.g. 'create'
 */
const checkPermission = (module, action) => {
  return (req, res, next) => {
    const { permissions, roleName } = req.user || {}

    // ADMIN bypass
    if (roleName === 'ADMIN') return next()

    const allowed = permissions?.some(
      (p) => p.module === module && p.action === action
    )

    if (!allowed) {
      return error(
        res,
        `Bạn không có quyền ${action} trên module ${module}`,
        403
      )
    }

    next()
  }
}

/**
 * Log user activity automatically
 * @param {string} action - e.g. 'CREATE_ORDER'
 * @param {string} module
 */
const logActivity = (action, module) => {
  return async (req, res, next) => {
    // Run after response is sent
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          await prisma.userActivityLog.create({
            data: {
              userId: req.user.id,
              action,
              module,
              detail: {
                method: req.method,
                path: req.path,
                params: req.params,
                body: sanitizeBody(req.body),
              },
              ipAddress: req.ip || req.connection?.remoteAddress,
              userAgent: req.headers['user-agent'],
            },
          })
        } catch (_) {
          // Non-critical, don't fail the request
        }
      }
    })
    next()
  }
}

/**
 * Remove sensitive fields before logging
 */
const sanitizeBody = (body = {}) => {
  const sensitive = ['password', 'currentPassword', 'newPassword', 'token']
  const sanitized = { ...body }
  sensitive.forEach((key) => {
    if (sanitized[key]) sanitized[key] = '[REDACTED]'
  })
  return sanitized
}

module.exports = { checkPermission, logActivity }
