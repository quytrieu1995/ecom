const { z } = require('zod')
const roleService = require('./role.service')
const { success, error } = require('../../utils/response')

const createRoleSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Tên role chỉ dùng chữ hoa và _'),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
})

const permissionsSchema = z.object({
  permissions: z.array(
    z.object({
      module: z.string(),
      action: z.string(),
    })
  ),
})

const handleListRoles = async (req, res, next) => {
  try {
    const roles = await roleService.listRoles()
    return success(res, roles)
  } catch (err) {
    next(err)
  }
}

const handleGetRole = async (req, res, next) => {
  try {
    const role = await roleService.getRoleById(req.params.id)
    return success(res, role)
  } catch (err) {
    next(err)
  }
}

const handleCreateRole = async (req, res, next) => {
  try {
    const data = createRoleSchema.parse(req.body)
    const role = await roleService.createRole(data)
    return success(res, role, 'Tạo role thành công', 201)
  } catch (err) {
    next(err)
  }
}

const handleUpdateRole = async (req, res, next) => {
  try {
    const role = await roleService.updateRole(req.params.id, req.body)
    return success(res, role, 'Cập nhật role thành công')
  } catch (err) {
    next(err)
  }
}

const handleUpdatePermissions = async (req, res, next) => {
  try {
    const { permissions } = permissionsSchema.parse(req.body)
    const role = await roleService.updateRolePermissions(req.params.id, permissions)
    return success(res, role, 'Cập nhật quyền thành công')
  } catch (err) {
    next(err)
  }
}

const handleDeleteRole = async (req, res, next) => {
  try {
    await roleService.deleteRole(req.params.id)
    return success(res, null, 'Xóa role thành công')
  } catch (err) {
    next(err)
  }
}

module.exports = {
  handleListRoles,
  handleGetRole,
  handleCreateRole,
  handleUpdateRole,
  handleUpdatePermissions,
  handleDeleteRole,
}
