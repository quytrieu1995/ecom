const { prisma } = require('../../config/database')
const { mapNhanhStatus } = require('../../modules/nhanhvn/nhanhvn.helpers')

module.exports = async (payload) => {
  const order = await prisma.order.findUnique({ where: { nhanhId: String(payload.idNhanh) } })
  if (!order) return

  await prisma.order.update({
    where: { nhanhId: String(payload.idNhanh) },
    data: {
      nhanhStatus: payload.status,
      nhanhData: payload,
      status: mapNhanhStatus(payload.status),
    },
  })
}
