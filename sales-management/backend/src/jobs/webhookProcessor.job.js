const Bull = require('bull')
const logger = require('../utils/logger')
const { prisma } = require('../config/database')

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}

const webhookQueue = new Bull('webhook-events', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
})

const handlers = {
  order_created: require('./handlers/webhook.orderCreated'),
  order_updated: require('./handlers/webhook.orderUpdated'),
  order_cancelled: require('./handlers/webhook.orderCancelled'),
  product_updated: require('./handlers/webhook.productUpdated'),
  inventory_updated: require('./handlers/webhook.inventoryUpdated'),
  customer_updated: require('./handlers/webhook.customerUpdated'),
}

const setupWebhookProcessor = () => {
  webhookQueue.process(async (job) => {
    const { event, payload } = job.data
    logger.info(`[Webhook] Processing event: ${event}, job #${job.id}`)

    const handler = handlers[event]
    if (!handler) {
      logger.warn(`[Webhook] No handler for event: ${event}`)
      return { skipped: true, event }
    }

    await handler(payload)
    logger.info(`[Webhook] Done: ${event}`)
    return { success: true, event }
  })

  webhookQueue.on('failed', (job, err) => {
    logger.error(`[Webhook] Job #${job.id} (${job.data.event}) failed: ${err.message}`)
    prisma.nhanhSyncLog.create({
      data: {
        type: job.data.event,
        direction: 'PULL',
        status: 'FAILED',
        payload: job.data.payload,
        error: err.message,
      },
    }).catch(() => {})
  })

  logger.info('[Webhook] Processor started')
  return webhookQueue
}

module.exports = { webhookQueue, setupWebhookProcessor }
