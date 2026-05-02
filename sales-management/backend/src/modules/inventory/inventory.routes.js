const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission, logActivity } = require('../../middleware/permission.middleware')
const { success, error, paginated } = require('../../utils/response')
const { prisma } = require('../../config/database')
const { cacheOrFetch } = require('../../config/redis')

router.use(authenticate)

// GET /api/v1/inventory/warehouses
router.get('/warehouses', async (req, res, next) => {
  try {
    const warehouses = await cacheOrFetch('warehouses:all', () =>
      prisma.warehouse.findMany({ orderBy: { name: 'asc' } }), 600
    )
    return success(res, warehouses)
  } catch (err) {
    next(err)
  }
})
router.get('/', checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { warehouseId, productId, lowStock } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (warehouseId) where.warehouseId = parseInt(warehouseId)
    if (productId) where.productId = parseInt(productId)
    if (lowStock === 'true') {
      // Compare quantity <= minQuantity per record using raw condition
      where.AND = [
        { quantity: { lte: 0 } },
      ]
    }

    // Override with proper field comparison via raw if lowStock requested
    if (lowStock === 'true') {
      const lowItems = await prisma.$queryRaw`
        SELECT id FROM inventory_items WHERE quantity <= min_quantity
      `
      const ids = lowItems.map((r) => r.id)
      if (ids.length === 0) return paginated(res, [], { page, limit, total: 0 })
      delete where.AND
      where.id = { in: ids }
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, code: true, images: true } },
          variant: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.inventoryItem.count({ where }),
    ])

    return paginated(res, items, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inventory/import
router.post('/import', checkPermission('inventory', 'create'), logActivity('IMPORT_INVENTORY', 'inventory'), async (req, res, next) => {
  try {
    const { productId, variantId, warehouseId, quantity, note } = req.body
    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      return error(res, 'Thiếu thông tin hoặc số lượng không hợp lệ', 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({
        where: { productId: parseInt(productId), variantId: variantId ? parseInt(variantId) : null, warehouseId: parseInt(warehouseId) },
      })

      const previousQty = existing?.quantity || 0
      const newQty = previousQty + parseInt(quantity)

      const item = await tx.inventoryItem.upsert({
        where: {
          productId_variantId_warehouseId: {
            productId: parseInt(productId),
            variantId: variantId ? parseInt(variantId) : null,
            warehouseId: parseInt(warehouseId),
          },
        },
        create: { productId: parseInt(productId), variantId: variantId ? parseInt(variantId) : null, warehouseId: parseInt(warehouseId), quantity: newQty },
        update: { quantity: newQty },
      })

      await tx.inventoryTransaction.create({
        data: {
          type: 'IMPORT',
          productId: parseInt(productId),
          variantId: variantId ? parseInt(variantId) : null,
          warehouseId: parseInt(warehouseId),
          quantity: parseInt(quantity),
          previousQty,
          newQty,
          note,
          createdBy: req.user.id,
        },
      })

      return item
    })

    return success(res, result, 'Nhập kho thành công', 201)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inventory/export
router.post('/export', checkPermission('inventory', 'create'), logActivity('EXPORT_INVENTORY', 'inventory'), async (req, res, next) => {
  try {
    const { productId, variantId, warehouseId, quantity, note } = req.body
    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      return error(res, 'Thiếu thông tin hoặc số lượng không hợp lệ', 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({
        where: { productId: parseInt(productId), variantId: variantId ? parseInt(variantId) : null, warehouseId: parseInt(warehouseId) },
      })

      if (!existing || existing.quantity < parseInt(quantity)) {
        throw Object.assign(new Error('Số lượng tồn kho không đủ'), { statusCode: 400 })
      }

      const newQty = existing.quantity - parseInt(quantity)

      const item = await tx.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      })

      await tx.inventoryTransaction.create({
        data: {
          type: 'EXPORT',
          productId: parseInt(productId),
          variantId: variantId ? parseInt(variantId) : null,
          warehouseId: parseInt(warehouseId),
          quantity: parseInt(quantity),
          previousQty: existing.quantity,
          newQty,
          note,
          createdBy: req.user.id,
        },
      })

      return item
    })

    return success(res, result, 'Xuất kho thành công', 201)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inventory/adjust
router.post('/adjust', checkPermission('inventory', 'update'), logActivity('ADJUST_INVENTORY', 'inventory'), async (req, res, next) => {
  try {
    const { productId, variantId, warehouseId, newQuantity, note } = req.body

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findFirst({
        where: { productId: parseInt(productId), variantId: variantId ? parseInt(variantId) : null, warehouseId: parseInt(warehouseId) },
      })

      const previousQty = existing?.quantity || 0

      const item = await tx.inventoryItem.upsert({
        where: {
          productId_variantId_warehouseId: {
            productId: parseInt(productId),
            variantId: variantId ? parseInt(variantId) : null,
            warehouseId: parseInt(warehouseId),
          },
        },
        create: { productId: parseInt(productId), variantId: variantId ? parseInt(variantId) : null, warehouseId: parseInt(warehouseId), quantity: parseInt(newQuantity) },
        update: { quantity: parseInt(newQuantity) },
      })

      await tx.inventoryTransaction.create({
        data: {
          type: 'ADJUST',
          productId: parseInt(productId),
          variantId: variantId ? parseInt(variantId) : null,
          warehouseId: parseInt(warehouseId),
          quantity: parseInt(newQuantity) - previousQty,
          previousQty,
          newQty: parseInt(newQuantity),
          note,
          createdBy: req.user.id,
        },
      })

      return item
    })

    return success(res, result, 'Điều chỉnh kho thành công')
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inventory/import/batch — nhập kho nhiều sản phẩm
router.post('/import/batch', checkPermission('inventory', 'create'), logActivity('IMPORT_INVENTORY_BATCH', 'inventory'), async (req, res, next) => {
  try {
    const { warehouseId, items, note: batchNote } = req.body

    if (!warehouseId || !Array.isArray(items) || items.length === 0) {
      return error(res, 'Thiếu kho hoặc danh sách sản phẩm', 400)
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return error(res, `Sản phẩm #${item.productId || '?'} thiếu thông tin hoặc số lượng không hợp lệ`, 400)
      }
    }

    const results = await prisma.$transaction(async (tx) => {
      const processed = []

      for (const item of items) {
        const pId = parseInt(item.productId)
        const vId = item.variantId ? parseInt(item.variantId) : null
        const wId = parseInt(warehouseId)
        const qty = parseInt(item.quantity)
        const itemNote = item.note || batchNote || null

        const existing = await tx.inventoryItem.findFirst({
          where: { productId: pId, variantId: vId, warehouseId: wId },
        })

        const previousQty = existing?.quantity || 0
        const newQty = previousQty + qty

        await tx.inventoryItem.upsert({
          where: { productId_variantId_warehouseId: { productId: pId, variantId: vId, warehouseId: wId } },
          create: { productId: pId, variantId: vId, warehouseId: wId, quantity: newQty },
          update: { quantity: newQty },
        })

        await tx.inventoryTransaction.create({
          data: {
            type: 'IMPORT', productId: pId, variantId: vId, warehouseId: wId,
            quantity: qty, previousQty, newQty,
            note: itemNote, createdBy: req.user.id,
          },
        })

        processed.push({ productId: pId, quantity: qty, previousQty, newQty })
      }

      return processed
    })

    return success(res, { imported: results.length, items: results }, `Nhập kho thành công ${results.length} sản phẩm`, 201)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/inventory/export/batch — xuất kho nhiều sản phẩm
router.post('/export/batch', checkPermission('inventory', 'create'), logActivity('EXPORT_INVENTORY_BATCH', 'inventory'), async (req, res, next) => {
  try {
    const { warehouseId, items, note: batchNote } = req.body

    if (!warehouseId || !Array.isArray(items) || items.length === 0) {
      return error(res, 'Thiếu kho hoặc danh sách sản phẩm', 400)
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return error(res, `Sản phẩm #${item.productId || '?'} số lượng không hợp lệ`, 400)
      }
    }

    const results = await prisma.$transaction(async (tx) => {
      // Pre-validate all quantities before any update
      for (const item of items) {
        const pId = parseInt(item.productId)
        const vId = item.variantId ? parseInt(item.variantId) : null
        const wId = parseInt(warehouseId)
        const qty = parseInt(item.quantity)

        const existing = await tx.inventoryItem.findFirst({
          where: { productId: pId, variantId: vId, warehouseId: wId },
          include: { product: { select: { name: true } } },
        })

        if (!existing || existing.quantity < qty) {
          throw Object.assign(
            new Error(`Sản phẩm "${existing?.product?.name || `ID:${pId}`}" không đủ tồn kho (còn ${existing?.quantity || 0}, cần ${qty})`),
            { statusCode: 400 }
          )
        }
      }

      const processed = []

      for (const item of items) {
        const pId = parseInt(item.productId)
        const vId = item.variantId ? parseInt(item.variantId) : null
        const wId = parseInt(warehouseId)
        const qty = parseInt(item.quantity)
        const itemNote = item.note || batchNote || null

        const existing = await tx.inventoryItem.findFirst({
          where: { productId: pId, variantId: vId, warehouseId: wId },
        })

        const previousQty = existing.quantity
        const newQty = previousQty - qty

        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        })

        await tx.inventoryTransaction.create({
          data: {
            type: 'EXPORT', productId: pId, variantId: vId, warehouseId: wId,
            quantity: qty, previousQty, newQty,
            note: itemNote, createdBy: req.user.id,
          },
        })

        processed.push({ productId: pId, quantity: qty, previousQty, newQty })
      }

      return processed
    })

    return success(res, { exported: results.length, items: results }, `Xuất kho thành công ${results.length} sản phẩm`, 201)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/inventory/transactions
router.get('/transactions', checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { type, productId, warehouseId, startDate, endDate } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (type) where.type = type
    if (productId) where.productId = parseInt(productId)
    if (warehouseId) where.warehouseId = parseInt(warehouseId)
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryTransaction.count({ where }),
    ])

    return paginated(res, transactions, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/inventory/report
router.get('/report', checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const { warehouseId, startDate, endDate } = req.query
    const cacheKey = `report:inventory:${warehouseId || 'all'}:${startDate}:${endDate}`

    const data = await cacheOrFetch(cacheKey, async () => {
      const where = {}
      if (warehouseId) where.warehouseId = parseInt(warehouseId)
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = new Date(startDate)
        if (endDate) where.createdAt.lte = new Date(endDate)
      }

      return prisma.inventoryTransaction.groupBy({
        by: ['productId', 'type'],
        where,
        _sum: { quantity: true },
      })
    }, 300)

    return success(res, data)
  } catch (err) {
    next(err)
  }
})

module.exports = router
