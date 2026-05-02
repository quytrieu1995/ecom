const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission, logActivity } = require('../../middleware/permission.middleware')
const { success, error, paginated } = require('../../utils/response')
const { prisma } = require('../../config/database')
const { z } = require('zod')

router.use(authenticate)

const orderSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'COD', 'MOMO', 'ZALOPAY']).default('CASH'),
  shippingAddress: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    province: z.string().optional(),
    district: z.string().optional(),
    ward: z.string().optional(),
  }).optional().nullable(),
  note: z.string().optional().nullable(),
  discount: z.number().min(0).default(0),
  shippingFee: z.number().min(0).default(0),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    variantId: z.number().int().positive().optional().nullable(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).default(0),
  })).min(1),
})

// GET /api/v1/orders
router.get('/', checkPermission('orders', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { status, customerId, startDate, endDate, search } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (status) where.status = status
    if (customerId) where.customerId = customerId
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ])

    return paginated(res, orders, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/orders/:id
router.get('/:id', checkPermission('orders', 'read'), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { include: { product: true, variant: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404)
    return success(res, order)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/orders
router.post('/', checkPermission('orders', 'create'), logActivity('CREATE_ORDER', 'orders'), async (req, res, next) => {
  try {
    const data = orderSchema.parse(req.body)

    const order = await prisma.$transaction(async (tx) => {
      // Calculate totals
      let subtotal = 0
      const orderItems = []

      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) throw Object.assign(new Error(`Sản phẩm #${item.productId} không tồn tại`), { statusCode: 400 })

        const variant = item.variantId
          ? await tx.productVariant.findUnique({ where: { id: item.variantId } })
          : null

        const itemTotal = (item.unitPrice - item.discount) * item.quantity
        subtotal += itemTotal

        orderItems.push({
          productId: product.id,
          variantId: item.variantId || null,
          productName: product.name,
          variantName: variant?.name || null,
          sku: variant?.sku || product.code,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: itemTotal,
        })
      }

      const total = subtotal - data.discount + data.shippingFee

      // Generate order code
      const code = `DH${Date.now()}`

      return tx.order.create({
        data: {
          code,
          customerId: data.customerId || null,
          status: 'PENDING',
          paymentMethod: data.paymentMethod,
          shippingAddress: data.shippingAddress,
          note: data.note,
          subtotal,
          discount: data.discount,
          shippingFee: data.shippingFee,
          total,
          createdById: req.user.id,
          items: { create: orderItems },
        },
        include: { items: true },
      })
    })

    return success(res, order, 'Tạo đơn hàng thành công', 201)
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/orders/:id/status
router.put('/:id/status', checkPermission('orders', 'update'), logActivity('UPDATE_ORDER_STATUS', 'orders'), async (req, res, next) => {
  try {
    const { status } = req.body
    const valid = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED']
    if (!valid.includes(status)) return error(res, 'Trạng thái không hợp lệ', 400)

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    })
    return success(res, order, 'Cập nhật trạng thái thành công')
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/orders/:id/sync-nhanhvn
router.post('/:id/sync-nhanhvn', checkPermission('orders', 'sync'), async (req, res, next) => {
  try {
    const nhanhApi = require('../../utils/nhanhvn.api')
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: { include: { product: true } } },
    })
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404)

    const nhanhOrder = {
      saleOrderCode: order.code,
      customerMobile: order.customer?.phone,
      customerName: order.customer?.name,
      calcTotalMoney: order.total,
      products: order.items.map((i) => ({
        idNhanh: i.product.nhanhId,
        quantity: i.quantity,
        price: i.unitPrice,
      })),
    }

    let result
    if (order.nhanhId) {
      result = await nhanhApi.updateOrder({ idNhanh: order.nhanhId, ...nhanhOrder })
    } else {
      result = await nhanhApi.addOrder(nhanhOrder)
      if (result.idNhanh) {
        await prisma.order.update({
          where: { id: order.id },
          data: { nhanhId: String(result.idNhanh) },
        })
      }
    }
    return success(res, result, 'Đã đồng bộ đơn hàng với nhanh.vn')
  } catch (err) {
    next(err)
  }
})

module.exports = router
