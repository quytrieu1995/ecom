const { prisma } = require('../../config/database')
const { mapNhanhStatus } = require('../../modules/nhanhvn/nhanhvn.helpers')

module.exports = async (payload) => {
  await prisma.order.upsert({
    where: { nhanhId: String(payload.idNhanh) },
    create: {
      code: payload.code || `NHANH_${payload.idNhanh}`,
      nhanhId: String(payload.idNhanh),
      nhanhStatus: payload.status,
      nhanhData: payload,
      total: payload.calcTotalMoney || 0,
      status: mapNhanhStatus(payload.status),
    },
    update: {
      nhanhStatus: payload.status,
      nhanhData: payload,
      status: mapNhanhStatus(payload.status),
    },
  })
}
