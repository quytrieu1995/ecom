const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const {
  handleLogin,
  handleRefresh,
  handleLogout,
  handleGetMe,
  handleChangePassword,
} = require('./auth.controller')

// Public routes
router.post('/login', handleLogin)
router.post('/refresh', handleRefresh)

// Protected routes
router.use(authenticate)
router.post('/logout', handleLogout)
router.get('/me', handleGetMe)
router.patch('/change-password', handleChangePassword)

module.exports = router
