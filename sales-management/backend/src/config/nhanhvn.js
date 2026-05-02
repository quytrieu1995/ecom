module.exports = {
  apiUrl: process.env.NHANHVN_API_URL || 'https://api.nhanh.vn',
  appId: process.env.NHANHVN_APP_ID,
  businessId: process.env.NHANHVN_BUSINESS_ID,
  accessToken: process.env.NHANHVN_ACCESS_TOKEN,
  secretKey: process.env.NHANHVN_SECRET_KEY,
  webhookUrl: process.env.NHANHVN_WEBHOOK_URL,
  syncIntervals: {
    products: parseInt(process.env.SYNC_PRODUCTS_INTERVAL || '30'),
    orders: parseInt(process.env.SYNC_ORDERS_INTERVAL || '15'),
    inventory: parseInt(process.env.SYNC_INVENTORY_INTERVAL || '60'),
  },
}
