const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission, logActivity } = require('../../middleware/permission.middleware')
const { success, error, paginated } = require('../../utils/response')
const { prisma } = require('../../config/database')

router.use(authenticate)

// GET /api/v1/customers
router.get('/', checkPermission('customers', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { search, type } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (type) where.type = type

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ])

    return paginated(res, customers, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/customers/:id
router.get('/:id', checkPermission('customers', 'read'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } })
    if (!customer) return error(res, 'Không tìm thấy khách hàng', 404)
    return success(res, customer)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/customers/:id/orders
router.get('/:id/orders', checkPermission('customers', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: req.params.id },
        skip,
        take: limit,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: { customerId: req.params.id } }),
    ])

    return paginated(res, orders, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/customers
router.post('/', checkPermission('customers', 'create'), logActivity('CREATE_CUSTOMER', 'customers'), async (req, res, next) => {
  try {
    const { name, phone, email, address, gender, birthday, type } = req.body
    if (!name) return error(res, 'Tên khách hàng là bắt buộc', 400)

    const code = `KH${Date.now()}`
    const customer = await prisma.customer.create({
      data: { code, name, phone, email, address, gender, birthday: birthday ? new Date(birthday) : null, type: type || 'RETAIL' },
    })
    return success(res, customer, 'Tạo khách hàng thành công', 201)
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/customers/:id
router.put('/:id', checkPermission('customers', 'update'), logActivity('UPDATE_CUSTOMER', 'customers'), async (req, res, next) => {
  try {
    const { name, phone, email, address, gender, birthday, type } = req.body
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(gender !== undefined && { gender }),
        ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
        ...(type && { type }),
      },
    })
    return success(res, customer, 'Cập nhật khách hàng thành công')
  } catch (err) {
    next(err)
  }
})

module.exports = router
