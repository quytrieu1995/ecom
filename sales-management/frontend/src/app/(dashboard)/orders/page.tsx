'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Search, Plus, X, Loader2, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PermissionGate } from '@/components/ui/PermissionGate'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = { id: number; name: string; code: string; salePrice: number; unit: string }
type Customer = { id: string; name: string; phone?: string | null; code: string }

// ─── Schema ───────────────────────────────────────────────────────────────────

const orderSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'COD', 'MOMO', 'ZALOPAY']),
  note: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  shippingFee: z.coerce.number().min(0).default(0),
  items: z
    .array(
      z.object({
        productId: z.number(),
        productName: z.string(),
        unitPrice: z.coerce.number().min(0),
        quantity: z.coerce.number().int().min(1),
        discount: z.coerce.number().min(0).default(0),
      })
    )
    .min(1, 'Cần ít nhất 1 sản phẩm'),
})

type OrderForm = z.infer<typeof orderSchema>

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xử lý', color: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-50 text-blue-700' },
  PROCESSING: { label: 'Đang xử lý', color: 'bg-indigo-50 text-indigo-700' },
  SHIPPING: { label: 'Đang giao', color: 'bg-purple-50 text-purple-700' },
  DELIVERED: { label: 'Đã giao', color: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-50 text-red-700' },
  RETURNED: { label: 'Trả hàng', color: 'bg-gray-100 text-gray-700' },
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Thẻ',
  COD: 'COD',
  MOMO: 'MoMo',
  ZALOPAY: 'ZaloPay',
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ─── Create Order Modal ───────────────────────────────────────────────────────

const CreateOrderModal = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) => {
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      paymentMethod: 'CASH',
      discount: 0,
      shippingFee: 0,
      items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')
  const watchDiscount = watch('discount') || 0
  const watchShipping = watch('shippingFee') || 0

  // Customer search
  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () =>
      customerSearch.length >= 2
        ? api.get('/customers', { params: { search: customerSearch, limit: 5 } }).then((r) => r.data.data)
        : Promise.resolve([]),
    enabled: customerSearch.length >= 2,
  })

  // Product search
  const { data: products } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: () =>
      productSearch.length >= 1
        ? api.get('/products', { params: { search: productSearch, limit: 10, status: 'ACTIVE' } }).then((r) => r.data.data)
        : Promise.resolve([]),
    enabled: productSearch.length >= 1,
  })

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setValue('customerId', c.id)
    setCustomerSearch('')
  }

  const handleAddProduct = (p: Product) => {
    const exists = fields.findIndex((f) => f.productId === p.id)
    if (exists >= 0) {
      const current = watchItems[exists]
      setValue(`items.${exists}.quantity`, (Number(current.quantity) || 1) + 1)
    } else {
      append({
        productId: p.id,
        productName: p.name,
        unitPrice: Number(p.salePrice),
        quantity: 1,
        discount: 0,
      })
    }
    setProductSearch('')
    setShowProductSearch(false)
  }

  // Totals
  const subtotal = watchItems.reduce((sum, item) => {
    const itemTotal = (Number(item.unitPrice) - Number(item.discount || 0)) * Number(item.quantity || 0)
    return sum + (isNaN(itemTotal) ? 0 : itemTotal)
  }, 0)
  const total = subtotal - Number(watchDiscount) + Number(watchShipping)

  const handleCreate = async (data: OrderForm) => {
    setServerError(null)
    try {
      await api.post('/orders', {
        ...data,
        customerId: data.customerId || null,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
        })),
        discount: Number(data.discount || 0),
        shippingFee: Number(data.shippingFee || 0),
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Tạo đơn hàng thất bại')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-6">
      <div className="relative w-full max-w-2xl rounded-xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Tạo đơn hàng mới</h2>
          <button onClick={onClose} aria-label="Đóng" className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleCreate)} className="space-y-5 p-6">
          {/* Customer */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Khách hàng</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-accent/50 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{selectedCustomer.name}</span>
                  {selectedCustomer.phone && (
                    <span className="ml-2 text-muted-foreground">{selectedCustomer.phone}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomer(null); setValue('customerId', null) }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm khách hàng theo tên hoặc SĐT (để trống = khách lẻ)"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className={`${inputCls} pl-9`}
                />
                {(customers as Customer[] | undefined)?.length ? (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                    {(customers as Customer[]).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Products */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Sản phẩm *</label>
              <button
                type="button"
                onClick={() => setShowProductSearch((v) => !v)}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm sản phẩm
                {showProductSearch ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {showProductSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm theo tên hoặc SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  autoFocus
                  className={`${inputCls} pl-9`}
                />
                {(products as Product[] | undefined)?.length ? (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                    {(products as Product[]).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                      >
                        <div className="text-left">
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{p.code}</span>
                        </div>
                        <span className="font-medium text-primary">{formatCurrency(p.salePrice)}</span>
                      </button>
                    ))}
                  </div>
                ) : productSearch.length >= 1 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
                    Không tìm thấy sản phẩm
                  </div>
                )}
              </div>
            )}

            {errors.items && (
              <p className="text-xs text-destructive">{errors.items.message || errors.items.root?.message}</p>
            )}

            {fields.length > 0 && (
              <div className="rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sản phẩm</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">Đơn giá</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground w-20">SL</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">Giảm giá</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">Thành tiền</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const item = watchItems[idx]
                      const lineTotal = (Number(item?.unitPrice) - Number(item?.discount || 0)) * Number(item?.quantity || 0)
                      return (
                        <tr key={field.id} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{field.productName}</p>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              {...register(`items.${idx}.unitPrice`)}
                              min={0}
                              className="h-7 w-24 rounded border border-input bg-background px-2 text-right text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="number"
                              {...register(`items.${idx}.quantity`)}
                              min={1}
                              className="h-7 w-16 rounded border border-input bg-background px-2 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              {...register(`items.${idx}.discount`)}
                              min={0}
                              placeholder="0"
                              className="h-7 w-24 rounded border border-input bg-background px-2 text-right text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </td>
                          <td className="px-2 py-2 text-right font-medium">
                            {formatCurrency(isNaN(lineTotal) ? 0 : lineTotal)}
                          </td>
                          <td className="pr-2 py-2">
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              aria-label="Xóa"
                              className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment + Discount + Shipping */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Phương thức TT</label>
              <select {...register('paymentMethod')} className={inputCls}>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Giảm giá đơn (đ)</label>
              <input type="number" {...register('discount')} min={0} placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Phí vận chuyển (đ)</label>
              <input type="number" {...register('shippingFee')} min={0} placeholder="0" className={inputCls} />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Ghi chú</label>
            <textarea
              {...register('note')}
              rows={2}
              placeholder="Ghi chú thêm..."
              className={`${inputCls} h-auto resize-none py-2`}
            />
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Giảm giá đơn</span>
                <span className="text-red-600">-{formatCurrency(Number(watchDiscount))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Phí vận chuyển</span>
                <span>{formatCurrency(Number(watchShipping))}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-base">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatCurrency(total < 0 ? 0 : total)}</span>
              </div>
            </div>
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || fields.length === 0}
              className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo đơn hàng
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, status],
    queryFn: () =>
      api
        .get('/orders', { params: { page, limit: 20, search, status: status || undefined } })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const orders = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Mã đơn, tên khách..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-9 w-60 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <PermissionGate module="orders" action="create">
          <button
            onClick={() => setShowCreate(true)}
            className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tạo đơn hàng
          </button>
        </PermissionGate>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Mã đơn</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Khách hàng</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Tổng tiền</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Thanh toán</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Trạng thái</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Nguồn</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Không có đơn hàng nào
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => {
                  const s = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3 font-mono text-xs font-medium">{order.code}</td>
                      <td className="p-3">{order.customer?.name || 'Khách lẻ'}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(order.total)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            order.paymentStatus === 'PAID'
                              ? 'bg-green-50 text-green-700'
                              : order.paymentStatus === 'PARTIAL'
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {order.paymentStatus === 'PAID'
                            ? 'Đã TT'
                            : order.paymentStatus === 'PARTIAL'
                            ? 'Một phần'
                            : 'Chưa TT'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <PermissionGate module="orders" action="update" fallback={
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
                        }>
                          <select
                            value={order.status}
                            onChange={(e) => updateStatusMutation.mutate({ id: order.id, status: e.target.value })}
                            className={`rounded-full border-0 bg-transparent px-2 py-0.5 text-xs font-medium cursor-pointer ${s.color}`}
                          >
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                              <option key={key} value={key}>{val.label}</option>
                            ))}
                          </select>
                        </PermissionGate>
                      </td>
                      <td className="p-3 text-center">
                        {order.nhanhId ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            nhanh.vn
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            Local
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">Tổng: {pagination.total} đơn hàng</p>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-muted-foreground">
                Trang {page}/{pagination.totalPages}
              </span>
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
        />
      )}
    </div>
  )
}
