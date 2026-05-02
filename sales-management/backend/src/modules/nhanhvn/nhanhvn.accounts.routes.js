const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission } = require('../../middleware/permission.middleware')
const { success, error, paginated } = require('../../utils/response')
const { prisma } = require('../../config/database')
const { createNhanhApi } = require('../../utils/nhanhvn.api')
const { syncProductsQueue } = require('../../jobs/syncProducts.job')
const { syncOrdersQueue } = require('../../jobs/syncOrders.job')
const { syncInventoryQueue } = require('../../jobs/syncInventory.job')

router.use(authenticate)

// ─── Helper: get API client for an account ────────────────────────────────────
const getApiForAccount = (account) =>
  createNhanhApi({
    appId: account.appId,
    businessId: account.businessId,
    accessToken: account.accessToken,
  })

// ─── List accounts ────────────────────────────────────────────────────────────

router.get('/', checkPermission('settings', 'read'), async (req, res, next) => {
  try {
    const accounts = await prisma.nhanhAccount.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        businessId: true,
        appId: true,
        isActive: true,
        lastSyncAt: true,
        syncInterval: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        // Never return accessToken / webhookSecret in list
      },
    })
    return success(res, accounts)
  } catch (err) {
    next(err)
  }
})

// ─── Get one account (with masked token) ─────────────────────────────────────

router.get('/:id', checkPermission('settings', 'read'), async (req, res, next) => {
  try {
    const account = await prisma.nhanhAccount.findUnique({
      where: { id: parseInt(req.params.id) },
    })
    if (!account) return error(res, 'Không tìm thấy tài khoản', 404)

    // Mask sensitive fields
    return success(res, {
      ...account,
      accessToken: account.accessToken ? `${account.accessToken.slice(0, 8)}${'*'.repeat(12)}` : null,
      webhookSecret: account.webhookSecret ? '••••••••' : null,
    })
  } catch (err) {
    next(err)
  }
})

// ─── Create account ───────────────────────────────────────────────────────────

router.post('/', checkPermission('settings', 'write'), async (req, res, next) => {
  try {
    const { name, businessId, appId, accessToken, webhookSecret, syncInterval, note, isActive } = req.body

    if (!name || !businessId || !appId || !accessToken) {
      return error(res, 'Thiếu thông tin bắt buộc: name, businessId, appId, accessToken', 400)
    }

    const account = await prisma.nhanhAccount.create({
      data: {
        name,
        businessId: String(businessId),
        appId: String(appId),
        accessToken,
        webhookSecret: webhookSecret || null,
        syncInterval: syncInterval ? parseInt(syncInterval) : 30,
        note: note || null,
        isActive: isActive !== false,
      },
    })

    return success(
      res,
      { id: account.id, name: account.name, businessId: account.businessId },
      'Đã thêm tài khoản Nhanh.vn',
      201
    )
  } catch (err) {
    next(err)
  }
})

// ─── Update account ───────────────────────────────────────────────────────────

router.put('/:id', checkPermission('settings', 'write'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.nhanhAccount.findUnique({ where: { id } })
    if (!existing) return error(res, 'Không tìm thấy tài khoản', 404)

    const { name, businessId, appId, accessToken, webhookSecret, syncInterval, note, isActive } = req.body

    const data = {}
    if (name !== undefined) data.name = name
    if (businessId !== undefined) data.businessId = String(businessId)
    if (appId !== undefined) data.appId = String(appId)
    if (accessToken !== undefined && accessToken !== '') data.accessToken = accessToken
    if (webhookSecret !== undefined) data.webhookSecret = webhookSecret || null
    if (syncInterval !== undefined) data.syncInterval = parseInt(syncInterval)
    if (note !== undefined) data.note = note || null
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    await prisma.nhanhAccount.update({ where: { id }, data })

    return success(res, null, 'Đã cập nhật tài khoản')
  } catch (err) {
    next(err)
  }
})

// ─── Delete account ───────────────────────────────────────────────────────────

router.delete('/:id', checkPermission('settings', 'delete'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.nhanhAccount.findUnique({ where: { id } })
    if (!existing) return error(res, 'Không tìm thấy tài khoản', 404)

    await prisma.nhanhAccount.delete({ where: { id } })
    return success(res, null, 'Đã xóa tài khoản')
  } catch (err) {
    next(err)
  }
})

// ─── Test connection ──────────────────────────────────────────────────────────

router.post('/:id/test', checkPermission('settings', 'read'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const account = await prisma.nhanhAccount.findUnique({ where: { id } })
    if (!account) return error(res, 'Không tìm thấy tài khoản', 404)

    const api = getApiForAccount(account)
    const result = await api.testConnection()

    return success(
      res,
      result,
      result.connected ? `Kết nối thành công (${result.latencyMs}ms)` : 'Kết nối thất bại'
    )
  } catch (err) {
    next(err)
  }
})

// ─── Manual sync per account ──────────────────────────────────────────────────

router.post('/:id/sync/products', checkPermission('products', 'sync'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const account = await prisma.nhanhAccount.findUnique({ where: { id, isActive: true } })
    if (!account) return error(res, 'Không tìm thấy tài khoản hoặc tài khoản đã bị tắt', 404)

    const job = await syncProductsQueue.add({
      type: 'manual',
      accountId: id,
      credentials: { appId: account.appId, businessId: account.businessId, accessToken: account.accessToken },
      triggeredBy: req.user.id,
    })
    return success(res, { jobId: job.id }, `Đã kích hoạt sync sản phẩm cho tài khoản "${account.name}"`)
  } catch (err) {
    next(err)
  }
})

router.post('/:id/sync/orders', checkPermission('orders', 'sync'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const account = await prisma.nhanhAccount.findUnique({ where: { id, isActive: true } })
    if (!account) return error(res, 'Không tìm thấy tài khoản hoặc tài khoản đã bị tắt', 404)

    const job = await syncOrdersQueue.add({
      type: 'manual',
      accountId: id,
      credentials: { appId: account.appId, businessId: account.businessId, accessToken: account.accessToken },
      triggeredBy: req.user.id,
    })
    return success(res, { jobId: job.id }, `Đã kích hoạt sync đơn hàng cho tài khoản "${account.name}"`)
  } catch (err) {
    next(err)
  }
})

router.post('/:id/sync/inventory', checkPermission('inventory', 'sync'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const account = await prisma.nhanhAccount.findUnique({ where: { id, isActive: true } })
    if (!account) return error(res, 'Không tìm thấy tài khoản hoặc tài khoản đã bị tắt', 404)

    const job = await syncInventoryQueue.add({
      type: 'manual',
      accountId: id,
      credentials: { appId: account.appId, businessId: account.businessId, accessToken: account.accessToken },
      triggeredBy: req.user.id,
    })
    return success(res, { jobId: job.id }, `Đã kích hoạt sync kho hàng cho tài khoản "${account.name}"`)
  } catch (err) {
    next(err)
  }
})

// ─── Sync logs per account ────────────────────────────────────────────────────

router.get('/:id/logs', checkPermission('settings', 'read'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const skip = (page - 1) * limit

    const where = { accountId: id }
    if (req.query.type) where.type = req.query.type
    if (req.query.status) where.status = req.query.status

    const [logs, total] = await Promise.all([
      prisma.nhanhSyncLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.nhanhSyncLog.count({ where }),
    ])

    return paginated(res, logs, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

module.exports = router
