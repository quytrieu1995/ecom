const bcrypt = require('bcryptjs')
const { prisma } = require('../../config/database')
const { invalidateAllUserTokens } = require('../auth/auth.service')

/**
 * List all users with pagination
 */
const listUsers = async ({ page = 1, limit = 20, search, roleId, status }) => {
  const skip = (page - 1) * limit
  const where = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (roleId) where.roleId = parseInt(roleId)
  if (status) where.status = status

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

/**
 * Get user by ID
 */
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      avatar: true,
      status: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      createdBy: true,
      role: { include: { permissions: true } },
    },
  })
  if (!user) throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })
  return user
}

/**
 * Create new user
 */
const createUser = async ({ email, password, name, phone, roleId, avatar }, createdById) => {
  const hashed = await bcrypt.hash(password, 12)
  return prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      password: hashed,
      name,
      phone,
      avatar,
      roleId: parseInt(roleId),
      mustChangePassword: true,
      createdBy: createdById,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      role: { select: { id: true, name: true, displayName: true } },
    },
  })
}

/**
 * Update user info
 */
const updateUser = async (id, { name, phone, avatar, roleId }) => {
  return prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(avatar !== undefined && { avatar }),
      ...(roleId && { roleId: parseInt(roleId) }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      avatar: true,
      status: true,
      role: { select: { id: true, name: true, displayName: true } },
    },
  })
}

/**
 * Update user status (ACTIVE/INACTIVE/SUSPENDED)
 */
const updateUserStatus = async (id, status, requesterId) => {
  // Prevent demoting the last ADMIN
  if (status !== 'ACTIVE') {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    })
    if (user?.role.name === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: { name: 'ADMIN' }, status: 'ACTIVE', id: { not: id } },
      })
      if (adminCount === 0) {
        throw Object.assign(
          new Error('Không thể vô hiệu hóa admin cuối cùng'),
          { statusCode: 400 }
        )
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  })

  // Invalidate all tokens if suspended
  if (status === 'SUSPENDED') {
    await invalidateAllUserTokens(id)
  }

  return updated
}

/**
 * Admin reset password
 */
const resetPassword = async (id, newPassword) => {
  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id },
    data: { password: hashed, mustChangePassword: true },
  })
  // Invalidate existing tokens
  await invalidateAllUserTokens(id)
}

/**
 * Soft delete user
 */
const deleteUser = async (id) => {
  // Guard: cannot delete last admin
  const user = await prisma.user.findUnique({ where: { id }, include: { role: true } })
  if (!user) throw Object.assign(new Error('Không tìm thấy người dùng'), { statusCode: 404 })

  if (user.role.name === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: { name: 'ADMIN' }, status: 'ACTIVE', id: { not: id } },
    })
    if (adminCount === 0) {
      throw Object.assign(new Error('Không thể xóa admin cuối cùng'), { statusCode: 400 })
    }
  }

  await invalidateAllUserTokens(id)
  // Soft delete: set status INACTIVE, anonymize email
  await prisma.user.update({
    where: { id },
    data: { status: 'INACTIVE', email: `deleted_${id}@deleted.local` },
  })
}

/**
 * Get user activity log
 */
const getUserActivity = async (userId, { page = 1, limit = 50, module, startDate, endDate }) => {
  const skip = (page - 1) * limit
  const where = { userId }

  if (module) where.module = module
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate)
  }

  const [logs, total] = await Promise.all([
    prisma.userActivityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userActivityLog.count({ where }),
  ])

  return { logs, total }
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetPassword,
  deleteUser,
  getUserActivity,
}
