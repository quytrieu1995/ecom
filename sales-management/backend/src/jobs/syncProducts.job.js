const Bull = require('bull')
const logger = require('../utils/logger')
const { prisma } = require('../config/database')
const nhanhApi = require('../utils/nhanhvn.api')

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}

const syncProductsQueue = new Bull('sync-products', { redis: redisConfig })

const setupSyncProductsJob = () => {
  const intervalMinutes = parseInt(process.env.SYNC_PRODUCTS_INTERVAL || '30')

  // Recurring job
  syncProductsQueue.add(
    { type: 'scheduled' },
    {
      repeat: { cron: `*/${intervalMinutes} * * * *` },
      removeOnComplete: 10,
      removeOnFail: 20,
    }
  )

  // Processor
  syncProductsQueue.process(async (job) => {
    logger.info(`[SyncProducts] Starting job #${job.id}`)
    const log = await prisma.nhanhSyncLog.create({
      data: { type: 'products', direction: 'PULL', status: 'PENDING' },
    })

    try {
      const products = await nhanhApi.getProducts()
      let synced = 0

      for (const p of products) {
        await prisma.product.upsert({
          where: { nhanhId: String(p.idNhanh) },
          create: {
            name: p.name,
            code: p.code || `NHANH_${p.idNhanh}`,
            nhanhId: String(p.idNhanh),
            nhanhData: p,
            salePrice: p.price || 0,
            costPrice: p.importPrice || 0,
            status: 'ACTIVE',
          },
          update: {
            name: p.name,
            nhanhData: p,
            salePrice: p.price || 0,
            costPrice: p.importPrice || 0,
          },
        })
        synced++
      }

      await prisma.nhanhSyncLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', response: { synced } },
      })

      logger.info(`[SyncProducts] Done — ${synced} products synced`)
      return { synced }
    } catch (err) {
      await prisma.nhanhSyncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: err.message },
      })
      throw err
    }
  })

  syncProductsQueue.on('failed', (job, err) => {
    logger.error(`[SyncProducts] Job #${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`)
  })

  logger.info(`[SyncProducts] Scheduled every ${intervalMinutes} minutes`)
  return syncProductsQueue
}

module.exports = { syncProductsQueue, setupSyncProductsJob }
