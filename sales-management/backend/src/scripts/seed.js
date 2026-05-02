require('dotenv').config()

const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// ─── Role definitions ────────────────────────────────────────────────────────

const ROLES = [
  {
    name: 'ADMIN',
    displayName: 'Quản trị viên',
    description: 'Toàn quyền hệ thống',
    isSystem: true,
    permissions: [], // ADMIN bypasses permission check
  },
  {
    name: 'MANAGER',
    displayName: 'Quản lý',
    description: 'Quản lý sản phẩm, kho, đơn hàng, khách hàng, báo cáo',
    isSystem: true,
    permissions: [
      { module: 'products',   action: 'read' },
      { module: 'products',   action: 'create' },
      { module: 'products',   action: 'update' },
      { module: 'products',   action: 'delete' },
      { module: 'products',   action: 'export' },
      { module: 'products',   action: 'sync' },
      { module: 'inventory',  action: 'read' },
      { module: 'inventory',  action: 'create' },
      { module: 'inventory',  action: 'update' },
      { module: 'inventory',  action: 'delete' },
      { module: 'inventory',  action: 'export' },
      { module: 'orders',     action: 'read' },
      { module: 'orders',     action: 'create' },
      { module: 'orders',     action: 'update' },
      { module: 'orders',     action: 'delete' },
      { module: 'orders',     action: 'export' },
      { module: 'orders',     action: 'sync' },
      { module: 'customers',  action: 'read' },
      { module: 'customers',  action: 'create' },
      { module: 'customers',  action: 'update' },
      { module: 'customers',  action: 'delete' },
      { module: 'customers',  action: 'export' },
      { module: 'reports',    action: 'read' },
      { module: 'reports',    action: 'export' },
    ],
  },
  {
    name: 'STAFF',
    displayName: 'Nhân viên bán hàng',
    description: 'Tạo và quản lý đơn hàng, khách hàng',
    isSystem: true,
    permissions: [
      { module: 'products',   action: 'read' },
      { module: 'inventory',  action: 'read' },
      { module: 'orders',     action: 'read' },
      { module: 'orders',     action: 'create' },
      { module: 'orders',     action: 'update' },
      { module: 'customers',  action: 'read' },
      { module: 'customers',  action: 'create' },
      { module: 'customers',  action: 'update' },
      { module: 'reports',    action: 'read' },
    ],
  },
  {
    name: 'ACCOUNTANT',
    displayName: 'Kế toán',
    description: 'Xem và xuất báo cáo, không thay đổi dữ liệu',
    isSystem: true,
    permissions: [
      { module: 'products',   action: 'read' },
      { module: 'inventory',  action: 'read' },
      { module: 'orders',     action: 'read' },
      { module: 'customers',  action: 'read' },
      { module: 'reports',    action: 'read' },
      { module: 'reports',    action: 'export' },
    ],
  },
  {
    name: 'VIEWER',
    displayName: 'Người xem',
    description: 'Chỉ xem, không thay đổi bất kỳ dữ liệu nào',
    isSystem: true,
    permissions: [
      { module: 'products',   action: 'read' },
      { module: 'inventory',  action: 'read' },
      { module: 'orders',     action: 'read' },
      { module: 'customers',  action: 'read' },
      { module: 'reports',    action: 'read' },
    ],
  },
]

// ─── Seed warehouses ─────────────────────────────────────────────────────────

const DEFAULT_WAREHOUSES = [
  { name: 'Kho chính', code: 'WH_MAIN', isDefault: true },
]

// ─── Main seed function ───────────────────────────────────────────────────────

const seed = async () => {
  console.log('🌱 Bắt đầu seed dữ liệu...')

  // 1. Create roles
  const createdRoles = {}
  for (const role of ROLES) {
    const existing = await prisma.role.findUnique({ where: { name: role.name } })
    if (existing) {
      console.log(`  ⏭️  Role ${role.name} đã tồn tại`)
      createdRoles[role.name] = existing
      continue
    }

    const created = await prisma.role.create({
      data: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        permissions: {
          create: role.permissions,
        },
      },
    })
    createdRoles[role.name] = created
    console.log(`  ✅ Role ${role.name} đã tạo với ${role.permissions.length} quyền`)
  }

  // 2. Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@thuanchay.vn'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024!'

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 12)
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashed,
        name: 'Administrator',
        roleId: createdRoles['ADMIN'].id,
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    })
    console.log(`  ✅ Admin user: ${adminEmail}`)
    console.log(`  ⚠️  Mật khẩu mặc định: ${adminPassword} — Hãy đổi ngay sau khi đăng nhập!`)
  } else {
    console.log(`  ⏭️  Admin user đã tồn tại`)
  }

  // 3. Create default warehouse
  for (const wh of DEFAULT_WAREHOUSES) {
    const existing = await prisma.warehouse.findUnique({ where: { code: wh.code } })
    if (!existing) {
      await prisma.warehouse.create({ data: wh })
      console.log(`  ✅ Kho: ${wh.name}`)
    } else {
      console.log(`  ⏭️  Kho ${wh.name} đã tồn tại`)
    }
  }

  console.log('\n✅ Seed hoàn tất!')
}

seed()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
