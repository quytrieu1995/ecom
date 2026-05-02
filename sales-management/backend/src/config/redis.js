const Redis = require('ioredis')
const logger = require('../utils/logger')

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
}

const redis = new Redis(redisConfig)

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error('Redis error:', err))
redis.on('close', () => logger.warn('Redis connection closed'))

const connectRedis = async () => {
  try {
    await redis.connect()
    logger.info('Redis connection established')
  } catch (err) {
    logger.error('Redis connection failed:', err)
    process.exit(1)
  }
}

/**
 * Cache helper — get or set with TTL
 * @param {string} key
 * @param {() => Promise<any>} fetchFn
 * @param {number} ttl - seconds
 */
const cacheOrFetch = async (key, fetchFn, ttl = 300) => {
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)
  } catch {
    // Redis unavailable — fall through to fetchFn
  }
  const data = await fetchFn()
  try {
    await redis.setex(key, ttl, JSON.stringify(data))
  } catch {
    // Non-critical
  }
  return data
}

/**
 * Add token to blacklist (for suspended/logged-out users)
 * @param {string} jti - JWT ID
 * @param {number} ttl - seconds until token would naturally expire
 */
const blacklistToken = async (jti, ttl) => {
  await redis.setex(`blacklist:${jti}`, ttl, '1')
}

/**
 * Check if token is blacklisted
 * @param {string} jti
 */
const isTokenBlacklisted = async (jti) => {
  const val = await redis.get(`blacklist:${jti}`)
  return val === '1'
}

module.exports = { redis, connectRedis, cacheOrFetch, blacklistToken, isTokenBlacklisted }
