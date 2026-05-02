const { prisma } = require('../../../config/database')

module.exports = async (payload) => {
  await prisma.customer.upsert({
    where: { nhanhId: String(payload.idNhanh) },
    create: {
      code: `KH_${payload.idNhanh}`,
      name: payload.name,
      phone: payload.mobile,
      email: payload.email,
      address: payload.address,
      nhanhId: String(payload.idNhanh),
    },
    update: {
      name: payload.name,
      phone: payload.mobile,
      email: payload.email,
      address: payload.address,
    },
  })
}
