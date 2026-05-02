/**
 * Standard API response helpers
 */

/**
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} [message]
 * @param {number} [statusCode]
 */
const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

/**
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode]
 * @param {any} [errors]
 */
const error = (res, message = 'Error', statusCode = 500, errors = null) => {
  const body = { success: false, message }
  if (errors) body.errors = errors
  return res.status(statusCode).json(body)
}

/**
 * @param {import('express').Response} res
 * @param {any[]} data
 * @param {object} pagination
 * @param {number} pagination.page
 * @param {number} pagination.limit
 * @param {number} pagination.total
 */
const paginated = (res, data, { page, limit, total }) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  })
}

module.exports = { success, error, paginated }
