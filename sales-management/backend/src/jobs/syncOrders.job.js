const Bull = require('bull')
const logger = require('../utils/logger')
const { prisma } = require('../config/database')
const nhanhApi = require('../utils/nhanhvn.api')

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}

const syncOrdersQueue = new Bull('sync-orders', { redis: redisConfig })

const setupSyncOrdersJob = () => {
  const intervalMinutes = parseInt(process.env.SYNC_ORDERS_INTERVAL || '15')

  syncOrdersQueue.add(
    { type: 'scheduled' },
    {
      repeat: { cron: `*/${intervalMinutes} * * * *` },
      removeOnComplete: 10,
      removeOnFail: 20,
    }
  )

  syncOrdersQueue.process(async (job) => {
    logger.info(`[SyncOrders] Starting job #${job.id}`)
    const log = await prisma.nhanhSyncLog.create({
      data: { type: 'orders', direction: 'PULL', status: 'PENDING' },
    })

    try {
      // Pull orders updated in last sync window
      const fromDate = new Date(Date.now() - intervalMinutes * 60 * 1000)
      const orders = await nhanhApi.getOrders({ fromDate })
      let synced = 0

      for (const o of orders) {
        await prisma.order.upsert({
          where: { nhanhId: String(o.idNhanh) },
          create: {
            code: o.code || `NHANH_${o.idNhanh}`,
            nhanhId: String(o.idNhanh),
            nhanhStatus: o.status,
            nhanhData: o,
            total: o.calcTotalMoney || 0,
            status: mapNhanhStatus(o.status),
          },
          update: {
            nhanhStatus: o.status,
            nhanhData: o,
            status: mapNhanhStatus(o.status),
          },
        })
        synced++
      }

      await prisma.nhanhSyncLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', response: { synced } },
      })

      logger.info(`[SyncOrders] Done — ${synced} orders synced`)
      return { synced }
    } catch (err) {
      await prisma.nhanhSyncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: err.message },
      })
      throw err
    }
  })

  syncOrdersQueue.on('failed', (job, err) => {
    logger.error(`[SyncOrders] Job #${job.id} failed: ${err.message}`)
  })

  logger.info(`[SyncOrders] Scheduled every ${intervalMinutes} minutes`)
  return syncOrdersQueue
}

/** Map nhanh.vn order status to local enum */
const mapNhanhStatus = (nhanhStatus) => {
  const map = {
    'New': 'PENDING',
    'Confirmed': 'CONFIRMED',
    'Packing': 'PROCESSING',
    'Delivering': 'SHIPPING',
    'Success': 'DELIVERED',
    'Cancelled': 'CANCELLED',
    'Returned': 'RETURNED',
  }
  return map[nhanhStatus] || 'PENDING'
}

module.exports = { syncOrdersQueue, setupSyncOrdersJob }
