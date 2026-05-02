const router = require('express').Router()
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware')
const { logActivity } = require('../../middleware/permission.middleware')
const {
  handleListUsers,
  handleGetUser,
  handleCreateUser,
  handleUpdateUser,
  handleUpdateStatus,
  handleResetPassword,
  handleDeleteUser,
  handleGetActivity,
} = require('./user.controller')

router.use(authenticate)

// Admin-only routes
router.get('/', requireAdmin, handleListUsers)
router.post('/', requireAdmin, logActivity('CREATE_USER', 'users'), handleCreateUser)
router.patch('/:id/status', requireAdmin, logActivity('UPDATE_USER_STATUS', 'users'), handleUpdateStatus)
router.patch('/:id/password', requireAdmin, logActivity('RESET_PASSWORD', 'users'), handleResetPassword)
router.delete('/:id', requireAdmin, logActivity('DELETE_USER', 'users'), handleDeleteUser)
router.get('/:id/activity', requireAdmin, handleGetActivity)

// Own profile or Admin
router.get('/:id', handleGetUser)
router.put('/:id', logActivity('UPDATE_USER', 'users'), handleUpdateUser)

module.exports = router
