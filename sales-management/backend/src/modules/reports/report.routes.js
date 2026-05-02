const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission } = require('../../middleware/permission.middleware')
const { success } = require('../../utils/response')
const { prisma } = require('../../config/database')
const { cacheOrFetch } = require('../../config/redis')

router.use(authenticate)
router.use(checkPermission('reports', 'read'))

// GET /api/v1/reports/inventory-summary
router.get('/inventory-summary', async (req, res, next) => {
  try {
    const { warehouseId } = req.query
    const cacheKey = `report:inv-summary:${warehouseId || 'all'}`

    const data = await cacheOrFetch(cacheKey, async () => {
      const where = warehouseId ? { warehouseId: parseInt(warehouseId) } : {}
      return prisma.inventoryItem.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { quantity: 'asc' },
      })
    }, 300)

    return success(res, data)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/sales — revenue by day/month
router.get('/sales', async (req, res, next) => {
  try {
    const { period = 'day', startDate, endDate } = req.query
    const cacheKey = `report:sales:${period}:${startDate}:${endDate}`

    const data = await cacheOrFetch(cacheKey, async () => {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
      const end = endDate ? new Date(endDate) : new Date()

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { notIn: ['CANCELLED', 'RETURNED'] },
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })

      // Group by period
      const groups = {}
      for (const o of orders) {
        const key =
          period === 'month'
            ? o.createdAt.toISOString().slice(0, 7)
            : o.createdAt.toISOString().slice(0, 10)
        if (!groups[key]) groups[key] = { date: key, revenue: 0, orders: 0 }
        groups[key].revenue += parseFloat(o.total)
        groups[key].orders++
      }

      return Object.values(groups)
    }, 300)

    return success(res, data)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/products — best sellers
router.get('/products', async (req, res, next) => {
  try {
    const { startDate, endDate, limit: lim = 20 } = req.query
    const cacheKey = `report:products:${startDate}:${endDate}:${lim}`

    const data = await cacheOrFetch(cacheKey, async () => {
      const where = {}
      if (startDate || endDate) {
        where.order = { createdAt: {} }
        if (startDate) where.order.createdAt.gte = new Date(startDate)
        if (endDate) where.order.createdAt.lte = new Date(endDate)
      }

      return prisma.orderItem.groupBy({
        by: ['productId'],
        where,
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: parseInt(lim),
      })
    }, 300)

    return success(res, data)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/customers
router.get('/customers', async (req, res, next) => {
  try {
    const cacheKey = `report:customers:top`
    const data = await cacheOrFetch(cacheKey, async () => {
      return prisma.customer.findMany({
        orderBy: { totalSpent: 'desc' },
        take: 50,
        select: {
          id: true, name: true, phone: true, type: true,
          totalOrders: true, totalSpent: true, createdAt: true,
        },
      })
    }, 300)

    return success(res, data)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/reports/dashboard — KPI summary for dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const cacheKey = 'report:dashboard'
    const data = await cacheOrFetch(cacheKey, async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const [
        todayOrders,
        todayRevenue,
        lowStockCount,
        newCustomers,
        recentOrders,
      ] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        prisma.order.aggregate({
          where: { createdAt: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] } },
          _sum: { total: true },
        }),
        prisma.inventoryItem.count({ where: { quantity: { lte: 5 } } }),
        prisma.customer.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { name: true } } },
        }),
      ])

      return {
        kpi: {
          todayOrders,
          todayRevenue: todayRevenue._sum.total || 0,
          lowStockCount,
          newCustomers,
        },
        recentOrders,
      }
    }, 60)

    return success(res, data)
  } catch (err) {
    next(err)
  }
})

module.exports = router
