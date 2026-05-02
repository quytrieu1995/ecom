require('dotenv').config()

const logger = require('./utils/logger')
const { connectDB } = require('./config/database')
const { connectRedis } = require('./config/redis')

// Import all job processors
const { setupSyncProductsJob } = require('./jobs/syncProducts.job')
const { setupSyncOrdersJob } = require('./jobs/syncOrders.job')
const { setupSyncInventoryJob } = require('./jobs/syncInventory.job')
const { setupWebhookProcessor } = require('./jobs/webhookProcessor.job')

const start = async () => {
  await connectDB()
  await connectRedis()

  logger.info('⚙️  Starting background worker...')

  setupSyncProductsJob()
  setupSyncOrdersJob()
  setupSyncInventoryJob()
  setupWebhookProcessor()

  logger.info('✅ All workers started')
}

start().catch((err) => {
  logger.error('Worker failed to start:', err)
  process.exit(1)
})
