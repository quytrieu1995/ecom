const crypto = require('crypto')
const { error } = require('../utils/response')
const logger = require('../utils/logger')

/**
 * Verify HMAC-SHA256 signature from nhanh.vn webhook
 * Header: X-Nhanh-Signature: sha256=<hex>
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-nhanh-signature']
  const secretKey = process.env.NHANHVN_SECRET_KEY

  if (!secretKey) {
    logger.warn('NHANHVN_SECRET_KEY not configured — skipping webhook verification')
    return next()
  }

  if (!signature) {
    logger.warn('Webhook received without signature header')
    return error(res, 'Thiếu chữ ký webhook', 401)
  }

  const rawBody = req.rawBody || JSON.stringify(req.body)
  const expected = `sha256=${crypto
    .createHmac('sha256', secretKey)
    .update(rawBody)
    .digest('hex')}`

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )

  if (!isValid) {
    logger.warn('Invalid webhook signature', { received: signature, expected })
    return error(res, 'Chữ ký webhook không hợp lệ', 401)
  }

  next()
}

/**
 * Capture raw body for signature verification
 */
const captureRawBody = (req, res, next) => {
  let data = ''
  req.on('data', (chunk) => (data += chunk))
  req.on('end', () => {
    req.rawBody = data
    next()
  })
}

module.exports = { verifyWebhookSignature, captureRawBody }
