/** Map nhanh.vn order status string to local OrderStatus enum */
const mapNhanhStatus = (nhanhStatus) => {
  const map = {
    New: 'PENDING',
    Confirmed: 'CONFIRMED',
    Packing: 'PROCESSING',
    Delivering: 'SHIPPING',
    Success: 'DELIVERED',
    Cancelled: 'CANCELLED',
    Returned: 'RETURNED',
  }
  return map[nhanhStatus] || 'PENDING'
}

module.exports = { mapNhanhStatus }
