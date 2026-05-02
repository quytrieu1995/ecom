export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED' | 'RETURNED'
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'COD' | 'MOMO' | 'ZALOPAY'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
export type CustomerType = 'RETAIL' | 'WHOLESALE'
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
export type InventoryTransactionType = 'IMPORT' | 'EXPORT' | 'ADJUST' | 'TRANSFER'

export interface User {
  id: string
  email: string
  name: string
  phone: string | null
  avatar: string | null
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
  role: Role
}

export interface Role {
  id: number
  name: string
  displayName: string
  description: string | null
  permissions: Permission[]
}

export interface Permission {
  id: number
  module: string
  action: string
  roleId: number
}

export interface Product {
  id: number
  name: string
  code: string
  barcode: string | null
  categoryId: number | null
  category: Category | null
  unit: string
  costPrice: number
  salePrice: number
  weight: number | null
  description: string | null
  images: string[]
  status: ProductStatus
  nhanhId: string | null
  variants: ProductVariant[]
  inventoryItems: InventoryItem[]
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: number
  productId: number
  name: string
  sku: string
  barcode: string | null
  costPrice: number
  salePrice: number
  attributes: Record<string, string>
  nhanhId: string | null
}

export interface Category {
  id: number
  name: string
  code: string | null
  parentId: number | null
}

export interface Warehouse {
  id: number
  name: string
  code: string
  address: string | null
  isDefault: boolean
}

export interface InventoryItem {
  id: number
  productId: number
  product: Pick<Product, 'id' | 'name' | 'code'>
  variantId: number | null
  variant: Pick<ProductVariant, 'id' | 'name' | 'sku'> | null
  warehouseId: number
  warehouse: Pick<Warehouse, 'id' | 'name' | 'code'>
  quantity: number
  minQuantity: number
  maxQuantity: number | null
}

export interface Customer {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  gender: string | null
  birthday: string | null
  type: CustomerType
  totalOrders: number
  totalSpent: number
  nhanhId: string | null
  createdAt: string
}

export interface Order {
  id: string
  code: string
  customerId: string | null
  customer: Pick<Customer, 'id' | 'name' | 'phone'> | null
  status: OrderStatus
  subtotal: number
  discount: number
  shippingFee: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  shippingAddress: {
    name: string
    phone: string
    address: string
    province?: string
    district?: string
    ward?: string
  } | null
  note: string | null
  nhanhId: string | null
  nhanhStatus: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId: number
  variantId: number | null
  productName: string
  variantName: string | null
  sku: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
}

export interface NhanhSyncLog {
  id: string
  type: string
  direction: 'PUSH' | 'PULL'
  status: 'SUCCESS' | 'FAILED' | 'PENDING'
  error: string | null
  createdAt: string
}
