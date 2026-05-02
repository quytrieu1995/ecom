const Bull = require('bull')
const logger = require('../utils/logger')
const { prisma } = require('../config/database')
const nhanhApi = require('../utils/nhanhvn.api')

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}

const syncInventoryQueue = new Bull('sync-inventory', { redis: redisConfig })

const setupSyncInventoryJob = () => {
  const intervalMinutes = parseInt(process.env.SYNC_INVENTORY_INTERVAL || '60')

  syncInventoryQueue.add(
    { type: 'scheduled' },
    {
      repeat: { cron: `0 */${intervalMinutes === 60 ? 1 : intervalMinutes} * * *` },
      removeOnComplete: 5,
      removeOnFail: 10,
    }
  )

  syncInventoryQueue.process(async (job) => {
    logger.info(`[SyncInventory] Starting job #${job.id}`)
    const log = await prisma.nhanhSyncLog.create({
      data: { type: 'inventory', direction: 'PULL', status: 'PENDING' },
    })

    try {
      const inventory = await nhanhApi.getInventory()
      let synced = 0

      const defaultWarehouse = await prisma.warehouse.findFirst({
        where: { isDefault: true },
      })

      if (!defaultWarehouse) {
        throw new Error('Không tìm thấy kho mặc định')
      }

      for (const item of inventory) {
        const product = await prisma.product.findUnique({
          where: { nhanhId: String(item.idNhanh) },
        })
        if (!product) continue

        await prisma.inventoryItem.upsert({
          where: {
            productId_variantId_warehouseId: {
              productId: product.id,
              variantId: null,
              warehouseId: defaultWarehouse.id,
            },
          },
          create: {
            productId: product.id,
            warehouseId: defaultWarehouse.id,
            quantity: item.remain || 0,
          },
          update: { quantity: item.remain || 0 },
        })
        synced++
      }

      await prisma.nhanhSyncLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', response: { synced } },
      })

      logger.info(`[SyncInventory] Done — ${synced} items synced`)
      return { synced }
    } catch (err) {
      await prisma.nhanhSyncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: err.message },
      })
      throw err
    }
  })

  syncInventoryQueue.on('failed', (job, err) => {
    logger.error(`[SyncInventory] Job #${job.id} failed: ${err.message}`)
  })

  logger.info(`[SyncInventory] Scheduled every ${intervalMinutes} minutes`)
  return syncInventoryQueue
}

module.exports = { syncInventoryQueue, setupSyncInventoryJob }
