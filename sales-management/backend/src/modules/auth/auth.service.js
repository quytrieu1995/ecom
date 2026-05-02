const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { prisma } = require('../../config/database')
const { redis, blacklistToken } = require('../../config/redis')
const logger = require('../../utils/logger')

/**
 * Build JWT payload with embedded permissions
 * @param {object} user - user from DB (with role + permissions)
 */
const buildTokenPayload = (user) => ({
  sub: user.id,
  email: user.email,
  roleId: user.roleId,
  roleName: user.role.name,
  permissions: user.role.permissions.map((p) => ({
    module: p.module,
    action: p.action,
  })),
  mustChangePassword: user.mustChangePassword,
  jti: uuidv4(),
})

/**
 * Sign access token
 */
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  })

/**
 * Sign refresh token
 */
const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId, jti: uuidv4() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  })

/**
 * Login user — returns tokens + user info
 */
const login = async ({ email, password, ipAddress, userAgent }) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      role: { include: { permissions: true } },
    },
  })

  if (!user) throw Object.assign(new Error('Email hoặc mật khẩu không đúng'), { statusCode: 401 })

  if (user.status === 'SUSPENDED') {
    throw Object.assign(new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên'), { statusCode: 401 })
  }

  if (user.status === 'INACTIVE') {
    throw Object.assign(new Error('Tài khoản chưa được kích hoạt'), { statusCode: 401 })
  }

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) throw Object.assign(new Error('Email hoặc mật khẩu không đúng'), { statusCode: 401 })

  const payload = buildTokenPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(user.id)

  // Persist refresh token
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshExpiry,
    },
  })

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
  })

  // Activity log
  await prisma.userActivityLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      ipAddress,
      userAgent,
    },
  })

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role.name,
      roleDisplayName: user.role.displayName,
      permissions: payload.permissions,
      mustChangePassword: user.mustChangePassword,
    },
  }
}

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (refreshToken) => {
  let decoded
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch {
    throw Object.assign(new Error('Refresh token không hợp lệ hoặc đã hết hạn'), { statusCode: 401 })
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  })

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw Object.assign(new Error('Refresh token đã hết hạn'), { statusCode: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: { role: { include: { permissions: true } } },
  })

  if (!user || user.status !== 'ACTIVE') {
    throw Object.assign(new Error('Tài khoản không hợp lệ'), { statusCode: 401 })
  }

  // Rotate: delete old, issue new refresh token
  await prisma.refreshToken.delete({ where: { token: refreshToken } })

  const payload = buildTokenPayload(user)
  const newAccessToken = signAccessToken(payload)
  const newRefreshToken = signRefreshToken(user.id)

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

/**
 * Logout — blacklist access token + delete refresh token
 */
const logout = async (userId, jti, refreshToken) => {
  // Blacklist the current access token
  const ttl = Math.floor(
    (jwt.decode(jti)?.exp || 0) - Date.now() / 1000
  ) || 900
  await blacklistToken(jti, ttl)

  // Remove refresh token
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  await prisma.userActivityLog.create({
    data: { userId, action: 'LOGOUT', module: 'auth' },
  })
}

/**
 * Invalidate ALL tokens for a user (used on suspension)
 */
const invalidateAllUserTokens = async (userId) => {
  await prisma.refreshToken.deleteMany({ where: { userId } })
  // Mark in Redis so active JWTs are rejected by auth middleware
  await redis.setex(`user_suspended:${userId}`, 7 * 24 * 3600, '1')
}

/**
 * Change password
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) throw Object.assign(new Error('Mật khẩu hiện tại không đúng'), { statusCode: 400 })

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, mustChangePassword: false },
  })
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
  invalidateAllUserTokens,
  changePassword,
  signAccessToken,
  buildTokenPayload,
}
