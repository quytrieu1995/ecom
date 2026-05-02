const { z } = require('zod')
const authService = require('./auth.service')
const { success, error } = require('../../utils/response')

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Phải có ít nhất 1 số')
    .regex(/[^A-Za-z0-9]/, 'Phải có ít nhất 1 ký tự đặc biệt'),
})

const handleLogin = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body)
    const result = await authService.login({
      ...data,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
    return success(res, result, 'Đăng nhập thành công')
  } catch (err) {
    next(err)
  }
}

const handleRefresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return error(res, 'Thiếu refresh token', 400)
    const tokens = await authService.refreshAccessToken(refreshToken)
    return success(res, tokens, 'Token đã được làm mới')
  } catch (err) {
    next(err)
  }
}

const handleLogout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    await authService.logout(req.user.id, req.user.jti, refreshToken)
    return success(res, null, 'Đăng xuất thành công')
  } catch (err) {
    next(err)
  }
}

const handleGetMe = async (req, res, next) => {
  try {
    const { prisma } = require('../../config/database')
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        mustChangePassword: true,
        lastLoginAt: true,
        role: {
          include: { permissions: true },
        },
      },
    })
    if (!user) return error(res, 'Không tìm thấy người dùng', 404)
    return success(res, user, 'OK')
  } catch (err) {
    next(err)
  }
}

const handleChangePassword = async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body)
    await authService.changePassword(req.user.id, data.currentPassword, data.newPassword)
    return success(res, null, 'Đổi mật khẩu thành công')
  } catch (err) {
    next(err)
  }
}

module.exports = {
  handleLogin,
  handleRefresh,
  handleLogout,
  handleGetMe,
  handleChangePassword,
}
