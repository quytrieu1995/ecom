const { prisma } = require('../../config/database')

module.exports = async (payload) => {
  if (!payload.products || !Array.isArray(payload.products)) return

  for (const item of payload.products) {
    await prisma.inventory.upsert({
      where: { nhanhId: String(item.idNhanh) },
      create: {
        nhanhId: String(item.idNhanh),
        quantity: item.remain || 0,
        nhanhData: item,
        product: {
          connectOrCreate: {
            where: { nhanhId: String(item.idNhanh) },
            create: {
              name: item.name || `Product ${item.idNhanh}`,
              code: `NHANH_${item.idNhanh}`,
              nhanhId: String(item.idNhanh),
              salePrice: 0,
            },
          },
        },
      },
      update: {
        quantity: item.remain || 0,
        nhanhData: item,
      },
    })
  }
}
