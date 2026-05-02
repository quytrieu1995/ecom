const router = require('express').Router()
const { authenticate } = require('../../middleware/auth.middleware')
const { checkPermission, logActivity } = require('../../middleware/permission.middleware')
const { success, error, paginated } = require('../../utils/response')
const { prisma } = require('../../config/database')
const { cacheOrFetch } = require('../../config/redis')
const { z } = require('zod')

router.use(authenticate)

const productSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  unit: z.string().default('Cái'),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  weight: z.number().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).default('ACTIVE'),
})

// GET /api/v1/products
router.get('/', checkPermission('products', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { search, categoryId, status } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (categoryId) where.categoryId = parseInt(categoryId)
    if (status) where.status = status

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          inventoryItems: { include: { warehouse: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])

    return paginated(res, products, { page, limit, total })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/products/categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await cacheOrFetch('categories:all', () =>
      prisma.category.findMany({ orderBy: { name: 'asc' } }), 300
    )
    return success(res, categories)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/products/:id
router.get('/:id', checkPermission('products', 'read'), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        variants: true,
        inventoryItems: { include: { warehouse: true } },
      },
    })
    if (!product) return error(res, 'Không tìm thấy sản phẩm', 404)
    return success(res, product)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/products
router.post('/', checkPermission('products', 'create'), logActivity('CREATE_PRODUCT', 'products'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body)
    const product = await prisma.product.create({ data: { ...data, images: data.images } })
    return success(res, product, 'Tạo sản phẩm thành công', 201)
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/products/:id
router.put('/:id', checkPermission('products', 'update'), logActivity('UPDATE_PRODUCT', 'products'), async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body)
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data,
    })
    return success(res, product, 'Cập nhật sản phẩm thành công')
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/products/:id
router.delete('/:id', checkPermission('products', 'delete'), logActivity('DELETE_PRODUCT', 'products'), async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'INACTIVE' },
    })
    return success(res, null, 'Đã xóa sản phẩm')
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/products/:id/sync-nhanhvn
router.post('/:id/sync-nhanhvn', checkPermission('products', 'sync'), async (req, res, next) => {
  try {
    const nhanhApi = require('../../utils/nhanhvn.api')
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!product) return error(res, 'Không tìm thấy sản phẩm', 404)

    if (product.nhanhId) {
      const result = await nhanhApi.updateProduct({
        idNhanh: product.nhanhId,
        name: product.name,
        price: product.salePrice,
        importPrice: product.costPrice,
      })
      return success(res, result, 'Đã đồng bộ lên nhanh.vn')
    } else {
      const result = await nhanhApi.addProduct({
        name: product.name,
        code: product.code,
        price: product.salePrice,
        importPrice: product.costPrice,
      })
      if (result.idNhanh) {
        await prisma.product.update({
          where: { id: product.id },
          data: { nhanhId: String(result.idNhanh) },
        })
      }
      return success(res, result, 'Đã đẩy sản phẩm lên nhanh.vn')
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
