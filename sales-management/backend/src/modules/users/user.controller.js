const { z } = require('zod')
const userService = require('./user.service')
const { success, error, paginated } = require('../../utils/response')

const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  roleId: z.number().int().positive(),
  avatar: z.string().url().optional().nullable(),
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  roleId: z.number().int().positive().optional(),
})

const handleListUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { search, roleId, status } = req.query

    const { users, total } = await userService.listUsers({ page, limit, search, roleId, status })
    return paginated(res, users, { page, limit, total })
  } catch (err) {
    next(err)
  }
}

const handleGetUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id)
    return success(res, user)
  } catch (err) {
    next(err)
  }
}

const handleCreateUser = async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body)
    const user = await userService.createUser(data, req.user.id)
    return success(res, user, 'Tạo người dùng thành công', 201)
  } catch (err) {
    next(err)
  }
}

const handleUpdateUser = async (req, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body)
    const user = await userService.updateUser(req.params.id, data)
    return success(res, user, 'Cập nhật thành công')
  } catch (err) {
    next(err)
  }
}

const handleUpdateStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
    if (!validStatuses.includes(status)) {
      return error(res, `Trạng thái không hợp lệ. Hợp lệ: ${validStatuses.join(', ')}`, 400)
    }
    const result = await userService.updateUserStatus(req.params.id, status, req.user.id)
    return success(res, result, 'Cập nhật trạng thái thành công')
  } catch (err) {
    next(err)
  }
}

const handleResetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 8) {
      return error(res, 'Mật khẩu mới tối thiểu 8 ký tự', 400)
    }
    await userService.resetPassword(req.params.id, newPassword)
    return success(res, null, 'Đặt lại mật khẩu thành công')
  } catch (err) {
    next(err)
  }
}

const handleDeleteUser = async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id)
    return success(res, null, 'Xóa người dùng thành công')
  } catch (err) {
    next(err)
  }
}

const handleGetActivity = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const { module, startDate, endDate } = req.query

    const { logs, total } = await userService.getUserActivity(req.params.id, {
      page,
      limit,
      module,
      startDate,
      endDate,
    })
    return paginated(res, logs, { page, limit, total })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  handleListUsers,
  handleGetUser,
  handleCreateUser,
  handleUpdateUser,
  handleUpdateStatus,
  handleResetPassword,
  handleDeleteUser,
  handleGetActivity,
}
