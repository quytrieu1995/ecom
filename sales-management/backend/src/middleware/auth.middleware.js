const jwt = require('jsonwebtoken')
const { error } = require('../utils/response')
const { isTokenBlacklisted } = require('../config/redis')
const { prisma } = require('../config/database')

/**
 * Verify JWT and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return error(res, 'Không có token xác thực', 401)
    }

    const token = authHeader.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // Check blacklist (suspended users / logged out)
    if (await isTokenBlacklisted(payload.jti)) {
      return error(res, 'Token đã bị thu hồi', 401)
    }

    // Attach minimal user info from token
    req.user = {
      id: payload.sub,
      email: payload.email,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions: payload.permissions || [],
      jti: payload.jti,
    }

    // Verify user still active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, roleId: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      return error(res, 'Tài khoản không hoạt động hoặc đã bị khóa', 401)
    }

    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Require ADMIN role
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.roleName !== 'ADMIN') {
    return error(res, 'Chỉ Admin mới có quyền thực hiện hành động này', 403)
  }
  next()
}

module.exports = { authenticate, requireAdmin }
