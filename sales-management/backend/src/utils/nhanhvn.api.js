const https = require('https')
const http = require('http')
const { URL } = require('url')
const nhanhConfig = require('../config/nhanhvn')
const logger = require('./logger')

/**
 * Lightweight HTTP client for nhanh.vn API
 * (uses built-in https — no extra dependencies)
 *
 * All nhanh.vn endpoints accept POST with form-encoded body:
 *   version=2.0&appId=XXX&businessId=XXX&accessToken=XXX&data=JSON
 */

const post = (path, data = {}) => {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      version: '2.0',
      appId: nhanhConfig.appId,
      businessId: nhanhConfig.businessId,
      accessToken: nhanhConfig.accessToken,
      data: JSON.stringify(data),
    }).toString()

    const url = new URL(nhanhConfig.apiUrl + path)
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

// ─── Product APIs ─────────────────────────────────────────────────────────────

/**
 * Search / list products
 * @param {object} params
 */
const getProducts = async (params = {}) => {
  logger.debug('[NhanhAPI] getProducts', params)
  const result = await post('/api/product/search', params)
  return result.products ? Object.values(result.products) : []
}

/**
 * Add product to nhanh.vn
 */
const addProduct = async (product) => {
  logger.debug('[NhanhAPI] addProduct', product.name)
  return post('/api/product/add', product)
}

/**
 * Update product on nhanh.vn
 */
const updateProduct = async (product) => {
  logger.debug('[NhanhAPI] updateProduct', product.idNhanh)
  return post('/api/product/update', product)
}

// ─── Inventory APIs ───────────────────────────────────────────────────────────

/**
 * Get inventory list (realtime stock)
 * @param {object} params
 */
const getInventory = async (params = {}) => {
  logger.debug('[NhanhAPI] getInventory')
  const result = await post('/api/inventory/list', params)
  return result.inventories ? Object.values(result.inventories) : []
}

/**
 * Get inventory adjustment history
 */
const getInventoryAdjustments = async (params = {}) => {
  logger.debug('[NhanhAPI] getInventoryAdjustments')
  return post('/api/inventory/getAdjusments', params)
}

// ─── Order APIs ───────────────────────────────────────────────────────────────

/**
 * Search / list orders
 * @param {object} params - { fromDate, toDate, status, page, ... }
 */
const getOrders = async (params = {}) => {
  logger.debug('[NhanhAPI] getOrders', params)
  const result = await post('/api/order/search', params)
  return result.orders ? Object.values(result.orders) : []
}

/**
 * Create order on nhanh.vn
 */
const addOrder = async (order) => {
  logger.debug('[NhanhAPI] addOrder', order.saleOrderCode)
  return post('/api/order/add', order)
}

/**
 * Update order status on nhanh.vn
 */
const updateOrder = async (order) => {
  logger.debug('[NhanhAPI] updateOrder', order.idNhanh)
  return post('/api/order/update', order)
}

// ─── Customer APIs ────────────────────────────────────────────────────────────

/**
 * Search customers
 */
const getCustomers = async (params = {}) => {
  logger.debug('[NhanhAPI] getCustomers')
  const result = await post('/api/customer/search', params)
  return result.customers ? Object.values(result.customers) : []
}

/**
 * Add customer
 */
const addCustomer = async (customer) => {
  logger.debug('[NhanhAPI] addCustomer', customer.name)
  return post('/api/customer/add', customer)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Get / refresh access token (partner login)
 */
const getAccessToken = async () => {
  return post('/api/partner/login', {
    appId: nhanhConfig.appId,
    businessId: nhanhConfig.businessId,
  })
}

// ─── Connection test ──────────────────────────────────────────────────────────

/**
 * Test nhanh.vn connection — tries to fetch 1 product
 */
const testConnection = async () => {
  try {
    await getProducts({ page: 1, icpp: 1 })
    return { connected: true }
  } catch (err) {
    return { connected: false, error: err.message }
  }
}

module.exports = {
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
