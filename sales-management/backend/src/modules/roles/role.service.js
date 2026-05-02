const { prisma } = require('../../config/database')

const DEFAULT_MODULES = ['products', 'inventory', 'orders', 'customers', 'reports', 'users', 'settings']
const DEFAULT_ACTIONS = ['read', 'create', 'update', 'delete', 'export', 'sync']

/**
 * List all roles with user count
 */
const listRoles = async () => {
  const roles = await prisma.role.findMany({
    include: {
      permissions: true,
      _count: { select: { users: true } },
    },
    orderBy: { id: 'asc' },
  })
  return roles
}

/**
 * Get role by ID with full permission matrix
 */
const getRoleById = async (id) => {
  const role = await prisma.role.findUnique({
    where: { id: parseInt(id) },
    include: {
      permissions: true,
      _count: { select: { users: true } },
    },
  })
  if (!role) throw Object.assign(new Error('Không tìm thấy role'), { statusCode: 404 })
  return role
}

/**
 * Create a new role
 */
const createRole = async ({ name, displayName, description }) => {
  return prisma.role.create({
    data: { name: name.toUpperCase(), displayName, description },
    include: { permissions: true },
  })
}

/**
 * Update role metadata
 */
const updateRole = async (id, { displayName, description }) => {
  const role = await prisma.role.findUnique({ where: { id: parseInt(id) } })
  if (!role) throw Object.assign(new Error('Không tìm thấy role'), { statusCode: 404 })
  if (role.isSystem && process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Không thể sửa system role trong production'), { statusCode: 400 })
  }

  return prisma.role.update({
    where: { id: parseInt(id) },
    data: { ...(displayName && { displayName }), ...(description !== undefined && { description }) },
  })
}

/**
 * Replace permissions for a role
 * @param {number} roleId
 * @param {Array<{module: string, action: string}>} permissions
 */
const updateRolePermissions = async (roleId, permissions) => {
  const id = parseInt(roleId)
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) throw Object.assign(new Error('Không tìm thấy role'), { statusCode: 404 })
  if (role.name === 'ADMIN') {
    throw Object.assign(new Error('Không thể sửa quyền của ADMIN'), { statusCode: 400 })
  }

  // Validate module/action values
  const invalid = permissions.filter(
    (p) => !DEFAULT_MODULES.includes(p.module) || !DEFAULT_ACTIONS.includes(p.action)
  )
  if (invalid.length > 0) {
    throw Object.assign(new Error(`Module/action không hợp lệ: ${JSON.stringify(invalid)}`), { statusCode: 400 })
  }

  // Replace all permissions atomically
  await prisma.$transaction([
    prisma.permission.deleteMany({ where: { roleId: id } }),
    prisma.permission.createMany({
      data: permissions.map((p) => ({ ...p, roleId: id })),
    }),
  ])

  return getRoleById(id)
}

/**
 * Delete role (only if no users assigned)
 */
const deleteRole = async (id) => {
  const role = await prisma.role.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { users: true } } },
  })
  if (!role) throw Object.assign(new Error('Không tìm thấy role'), { statusCode: 404 })
  if (role.isSystem) throw Object.assign(new Error('Không thể xóa system role'), { statusCode: 400 })
  if (role._count.users > 0) {
    throw Object.assign(
      new Error(`Role đang được ${role._count.users} người dùng sử dụng`),
      { statusCode: 400 }
    )
  }
  await prisma.role.delete({ where: { id: parseInt(id) } })
}

module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
}
