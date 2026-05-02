const { prisma } = require('../../../config/database')

module.exports = async (payload) => {
  const product = await prisma.product.findUnique({ where: { nhanhId: String(payload.idNhanh) } })
  if (!product) return

  const warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } })
  if (!warehouse) return

  await prisma.inventoryItem.upsert({
    where: {
      productId_variantId_warehouseId: {
        productId: product.id,
        variantId: null,
        warehouseId: warehouse.id,
      },
    },
    create: { productId: product.id, warehouseId: warehouse.id, quantity: payload.remain || 0 },
    update: { quantity: payload.remain || 0 },
  })
}
