const { PrismaClient } = require('@prisma/client')
const logger = require('../utils/logger')

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
})

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Query: ${e.query} — ${e.duration}ms`)
  })
}

prisma.$on('error', (e) => {
  logger.error('Prisma error:', e)
})

const connectDB = async () => {
  try {
    await prisma.$connect()
    logger.info('PostgreSQL connected via Prisma')
  } catch (err) {
    logger.error('PostgreSQL connection failed:', err)
    process.exit(1)
  }
}

module.exports = { prisma, connectDB }
