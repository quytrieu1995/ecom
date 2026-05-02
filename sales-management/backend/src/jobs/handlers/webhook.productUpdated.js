const { prisma } = require('../../../config/database')

module.exports = async (payload) => {
  await prisma.product.upsert({
    where: { nhanhId: String(payload.idNhanh) },
    create: {
      name: payload.name,
      code: payload.code || `NHANH_${payload.idNhanh}`,
      nhanhId: String(payload.idNhanh),
      nhanhData: payload,
      salePrice: payload.price || 0,
      costPrice: payload.importPrice || 0,
    },
    update: {
      name: payload.name,
      nhanhData: payload,
      salePrice: payload.price || 0,
      costPrice: payload.importPrice || 0,
    },
  })
}
