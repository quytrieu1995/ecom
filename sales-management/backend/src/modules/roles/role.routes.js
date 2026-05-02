const router = require('express').Router()
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware')
const {
  handleListRoles,
  handleGetRole,
  handleCreateRole,
  handleUpdateRole,
  handleUpdatePermissions,
  handleDeleteRole,
} = require('./role.controller')

router.use(authenticate)

router.get('/', handleListRoles)
router.get('/:id', handleGetRole)

// Admin-only mutations
router.post('/', requireAdmin, handleCreateRole)
router.put('/:id', requireAdmin, handleUpdateRole)
router.put('/:id/permissions', requireAdmin, handleUpdatePermissions)
router.delete('/:id', requireAdmin, handleDeleteRole)

module.exports = router
