const https = require('https')
const http = require('http')
const { URL } = require('url')
const nhanhConfig = require('../config/nhanhvn')
const logger = require('./logger')

/**
 * Lightweight HTTP client for nhanh.vn API.
 * Supports both default config (from env) and dynamic per-account credentials.
 *
 * All nhanh.vn endpoints accept POST with form-encoded body:
 *   version=2.0&appId=XXX&businessId=XXX&accessToken=XXX&data=JSON
 */

/**
 * Create a nhanh.vn API client for a given set of credentials.
 * @param {{ appId: string, businessId: string, accessToken: string, apiUrl?: string }} credentials
 */
const createNhanhApi = (credentials = {}) => {
  const cfg = {
    appId: credentials.appId || nhanhConfig.appId,
    businessId: credentials.businessId || nhanhConfig.businessId,
    accessToken: credentials.accessToken || nhanhConfig.accessToken,
    apiUrl: credentials.apiUrl || nhanhConfig.apiUrl,
  }

  const post = (path, data = {}) => {
    return new Promise((resolve, reject) => {
      const body = new URLSearchParams({
        version: '2.0',
        appId: cfg.appId,
        businessId: cfg.businessId,
        accessToken: cfg.accessToken,
        data: JSON.stringify(data),
      }).toString()

      const url = new URL(cfg.apiUrl + path)
      const isHttps = url.protocol === 'https:'
      const lib = isHttps ? https : http

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      }

      const req = lib.request(options, (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw)
            if (parsed.code !== 1) {
              reject(
                Object.assign(new Error(parsed.messages || 'nhanh.vn API error'), {
                  nhanhCode: parsed.code,
                  nhanhResponse: parsed,
                })
              )
            } else {
              resolve(parsed.data || parsed)
            }
          } catch {
            reject(new Error(`nhanh.vn invalid JSON: ${raw.slice(0, 200)}`))
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('nhanh.vn API timeout'))
      })

      req.write(body)
      req.end()
    })
  }

  // ─── Product APIs ───────────────────────────────────────────────────────────

  const getProducts = async (params = {}) => {
    logger.debug('[NhanhAPI] getProducts', { businessId: cfg.businessId, params })
    const result = await post('/api/product/search', params)
    return result.products ? Object.values(result.products) : []
  }

  const addProduct = async (product) => {
    logger.debug('[NhanhAPI] addProduct', product.name)
    return post('/api/product/add', product)
  }

  const updateProduct = async (product) => {
    logger.debug('[NhanhAPI] updateProduct', product.idNhanh)
    return post('/api/product/update', product)
  }

  // ─── Inventory APIs ─────────────────────────────────────────────────────────

  const getInventory = async (params = {}) => {
    logger.debug('[NhanhAPI] getInventory', { businessId: cfg.businessId })
    const result = await post('/api/inventory/list', params)
    return result.inventories ? Object.values(result.inventories) : []
  }

  const getInventoryAdjustments = async (params = {}) => {
    logger.debug('[NhanhAPI] getInventoryAdjustments')
    return post('/api/inventory/getAdjusments', params)
  }

  // ─── Order APIs ─────────────────────────────────────────────────────────────

  const getOrders = async (params = {}) => {
    logger.debug('[NhanhAPI] getOrders', { businessId: cfg.businessId, params })
    const result = await post('/api/order/search', params)
    return result.orders ? Object.values(result.orders) : []
  }

  const addOrder = async (order) => {
    logger.debug('[NhanhAPI] addOrder', order.saleOrderCode)
    return post('/api/order/add', order)
  }

  const updateOrder = async (order) => {
    logger.debug('[NhanhAPI] updateOrder', order.idNhanh)
    return post('/api/order/update', order)
  }

  // ─── Customer APIs ──────────────────────────────────────────────────────────

  const getCustomers = async (params = {}) => {
    logger.debug('[NhanhAPI] getCustomers', { businessId: cfg.businessId })
    const result = await post('/api/customer/search', params)
    return result.customers ? Object.values(result.customers) : []
  }

  const addCustomer = async (customer) => {
    logger.debug('[NhanhAPI] addCustomer', customer.name)
    return post('/api/customer/add', customer)
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  const getAccessToken = async () => {
    return post('/api/partner/login', {
      appId: cfg.appId,
      businessId: cfg.businessId,
    })
  }

  // ─── Connection test ────────────────────────────────────────────────────────

  /**
   * Test connection by fetching 1 product.
   * Returns { connected, businessId, latencyMs, error? }
   */
  const testConnection = async () => {
    const start = Date.now()
    try {
      await getProducts({ page: 1, icpp: 1 })
      return { connected: true, businessId: cfg.businessId, latencyMs: Date.now() - start }
    } catch (err) {
      return { connected: false, businessId: cfg.businessId, error: err.message, latencyMs: Date.now() - start }
    }
  }

  return {
    getProducts,
    addProduct,
    updateProduct,
    getInventory,
    getInventoryAdjustments,
    getOrders,
    addOrder,
    updateOrder,
    getCustomers,
    addCustomer,
    getAccessToken,
    testConnection,
  }
}

// ─── Default singleton (uses .env credentials) ───────────────────────────────
const defaultApi = createNhanhApi()

module.exports = defaultApi
module.exports.createNhanhApi = createNhanhApi
