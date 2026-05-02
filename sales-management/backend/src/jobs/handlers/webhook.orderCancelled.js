const { prisma } = require('../../../config/database')

module.exports = async (payload) => {
  await prisma.order.updateMany({
    where: { nhanhId: String(payload.idNhanh) },
    data: { status: 'CANCELLED', nhanhStatus: 'Cancelled', nhanhData: payload },
  })
}
