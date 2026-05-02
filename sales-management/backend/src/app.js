require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const fs = require('fs')
const path = require('path')

const { connectDB } = require('./config/database')
const { connectRedis } = require('./config/redis')
const logger = require('./utils/logger')
const { errorMiddleware, notFoundMiddleware } = require('./middleware/error.middleware')

// ─── Route imports ──────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes')
const userRoutes = require('./modules/users/user.routes')
const roleRoutes = require('./modules/roles/role.routes')
const productRoutes = require('./modules/products/product.routes')
const inventoryRoutes = require('./modules/inventory/inventory.routes')
const orderRoutes = require('./modules/orders/order.routes')
const customerRoutes = require('./modules/customers/customer.routes')
const reportRoutes = require('./modules/reports/report.routes')
const nhanhvnRoutes = require('./modules/nhanhvn/nhanhvn.routes')
const nhanhAccountRoutes = require('./modules/nhanhvn/nhanhvn.accounts.routes')
const webhookRoutes = require('./modules/nhanhvn/webhook.routes')

const app = express()
const PORT = process.env.PORT || 4000

// ─── Ensure logs directory ───────────────────────────────────────────────────
const logsDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

// ─── Trust proxy (behind Nginx) ──────────────────────────────────────────────
app.set('trust proxy', 1)

// ─── Security ────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
)

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  'https://ql.thuanchay.vn',
  'http://localhost:3001',
  'http://localhost:3000',
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (no Origin header) or matching origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        // Don't throw — just deny silently (browser handles CORS error)
        callback(null, false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Nhanh-Signature'],
  })
)

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression())

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ─── HTTP logging ────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/api/v1/health',
  })
)

// ─── Rate limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều request, vui lòng thử lại sau' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau 15 phút' },
})

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (req, res) => {
  const { prisma } = require('./config/database')
  const { redis } = require('./config/redis')

  let dbStatus = 'ok'
  let redisStatus = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  try {
    await redis.ping()
  } catch {
    redisStatus = 'error'
  }

  const healthy = dbStatus === 'ok' && redisStatus === 'ok'
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { database: dbStatus, redis: redisStatus },
    version: process.env.npm_package_version || '1.0.0',
  })
})

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter, authRoutes)
app.use('/api/v1/users', apiLimiter, userRoutes)
app.use('/api/v1/roles', apiLimiter, roleRoutes)
app.use('/api/v1/products', apiLimiter, productRoutes)
app.use('/api/v1/inventory', apiLimiter, inventoryRoutes)
app.use('/api/v1/orders', apiLimiter, orderRoutes)
app.use('/api/v1/customers', apiLimiter, customerRoutes)
app.use('/api/v1/reports', apiLimiter, reportRoutes)
app.use('/api/v1/sync', apiLimiter, nhanhvnRoutes)
app.use('/api/v1/nhanh/accounts', apiLimiter, nhanhAccountRoutes)
app.use('/webhooks', webhookRoutes)

// ─── Swagger docs ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const swaggerUi = require('swagger-ui-express')
  const swaggerDoc = {
    openapi: '3.0.0',
    info: {
      title: 'Sales Management API',
      version: '1.0.0',
      description: 'Hệ thống quản lý bán hàng tích hợp nhanh.vn',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  }
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))
  logger.info('Swagger docs: http://localhost:4000/api/docs')
}

// ─── 404 & error handlers ────────────────────────────────────────────────────
app.use(notFoundMiddleware)
app.use(errorMiddleware)

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB()
  await connectRedis()

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`)
  })
}

start().catch((err) => {
  logger.error('Failed to start server:', err)
  process.exit(1)
})

module.exports = app
