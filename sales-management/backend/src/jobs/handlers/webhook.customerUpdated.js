const { prisma } = require('../../config/database')

module.exports = async (payload) => {
  await prisma.customer.upsert({
    where: { nhanhId: String(payload.idNhanh || payload.id) },
    create: {
      name: payload.name,
      nhanhId: String(payload.idNhanh || payload.id),
      phone: payload.mobile || payload.phone || null,
      email: payload.email || null,
      nhanhData: payload,
    },
    update: {
      name: payload.name,
      phone: payload.mobile || payload.phone || null,
      email: payload.email || null,
      nhanhData: payload,
    },
  })
}
