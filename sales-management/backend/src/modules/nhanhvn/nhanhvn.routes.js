const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission } = require('../../middleware/permission.middleware')
const { success, error, paginated } = require('../../utils/response')
const { prisma } = require('../../config/database')
const nhanhApi = require('../../utils/nhanhvn.api')
const { syncProductsQueue } = require('../../jobs/syncProducts.job')
const { syncOrdersQueue } = require('../../jobs/syncOrders.job')
const { syncInventoryQueue } = require('../../jobs/syncInventory.job')

router.use(authenticate)

// ─── Manual trigger sync ──────────────────────────────────────────────────────

router.post('/products', checkPermission('products', 'sync'), async (req, res, next) => {
  try {
    const job = await syncProductsQueue.add({ type: 'manual', triggeredBy: req.user.id })
    return success(res, { jobId: job.id }, 'Đã kích hoạt sync sản phẩm')
  } catch (err) {
    next(err)
  }
})

router.post('/orders', checkPermission('orders', 'sync'), async (req, res, next) => {
  try {
    const job = await syncOrdersQueue.add({ type: 'manual', triggeredBy: req.user.id })
    return success(res, { jobId: job.id }, 'Đã kích hoạt sync đơn hàng')
  } catch (err) {
    next(err)
  }
})

router.post('/inventory', checkPermission('inventory', 'sync'), async (req, res, next) => {
  try {
    const job = await syncInventoryQueue.add({ type: 'manual', triggeredBy: req.user.id })
    return success(res, { jobId: job.id }, 'Đã kích hoạt sync kho hàng')
  } catch (err) {
    next(err)
  }
})

// ─── Test connection ──────────────────────────────────────────────────────────

router.get('/test-connection', async (req, res, next) => {
  try {
    const result = await nhanhApi.testConnection()
    return success(res, result, result.connected ? 'Kết nối thành công' : 'Kết nối thất bại')
  } catch (err) {
    next(err)
  }
})

// ─── Sync logs ────────────────────────────────────────────────────────────────

router.get('/logs', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const { type, status } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (type) where.type = type
    if (status) where.status = status

    const [logs, total] = await Promise.all([
      prisma.nhanhSyncLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.nhanhSyncLog.count({ where }),
    ])

    return paginated(res, logs, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

module.exports = router
