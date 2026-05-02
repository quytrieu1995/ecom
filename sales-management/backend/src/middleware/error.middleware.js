const logger = require('../utils/logger')
const { error } = require('../utils/response')

/**
 * Global error handling middleware
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    stack: err.stack,
    body: req.body,
    params: req.params,
  })

  // Prisma known errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field'
    return error(res, `Giá trị ${field} đã tồn tại`, 409)
  }

  if (err.code === 'P2025') {
    return error(res, 'Không tìm thấy dữ liệu', 404)
  }

  if (err.code === 'P2003') {
    return error(res, 'Dữ liệu liên kết không tồn tại', 400)
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Token không hợp lệ', 401)
  }

  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token đã hết hạn', 401)
  }

  // Validation errors
  if (err.name === 'ZodError') {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return error(res, 'Dữ liệu không hợp lệ', 422, errors)
  }

  // Default
  const statusCode = err.statusCode || err.status || 500
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Lỗi máy chủ nội bộ'
      : err.message || 'Lỗi máy chủ nội bộ'

  return error(res, message, statusCode)
}

/**
 * 404 Not Found handler
 */
const notFoundMiddleware = (req, res) => {
  return error(res, `Route ${req.method} ${req.path} không tồn tại`, 404)
}

module.exports = { errorMiddleware, notFoundMiddleware }
