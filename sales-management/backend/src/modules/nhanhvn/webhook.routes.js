const { verifyWebhookSignature } = require('../../middleware/webhook.middleware')
const { webhookQueue } = require('../../jobs/webhookProcessor.job')
const { prisma } = require('../../config/database')
const { success, error } = require('../../utils/response')
const logger = require('../../utils/logger')
const router = require('express').Router()

const SUPPORTED_EVENTS = [
  'order_created',
  'order_updated',
  'order_cancelled',
  'product_updated',
  'inventory_updated',
  'customer_updated',
]

/**
 * POST /webhooks/nhanhvn
 *
 * Flow:
 * 1. Verify HMAC-SHA256 signature
 * 2. Push event to Bull queue
 * 3. Return 200 immediately
 */
router.post('/nhanhvn', verifyWebhookSignature, async (req, res) => {
  const { event, data } = req.body

  logger.info(`[Webhook] Received: ${event}`)

  if (!event) {
    return error(res, 'Thiếu trường event', 400)
  }

  if (!SUPPORTED_EVENTS.includes(event)) {
    logger.warn(`[Webhook] Unknown event: ${event}`)
    // Still return 200 to avoid nhanh.vn retries for unsupported events
    return success(res, { received: true, event }, 'Event không được hỗ trợ nhưng đã nhận')
  }

  try {
    await webhookQueue.add(
      { event, payload: data || req.body },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    )

    // Log receipt (async, non-blocking)
    prisma.nhanhSyncLog.create({
      data: {
        type: event,
        direction: 'PULL',
        status: 'PENDING',
        payload: data || req.body,
      },
    }).catch(() => {})

    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error(`[Webhook] Failed to queue event ${event}:`, err)
    return error(res, 'Lỗi xử lý webhook', 500)
  }
})

module.exports = router
