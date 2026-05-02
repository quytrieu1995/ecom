'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, RefreshCw, Pencil, X, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { usePermission } from '@/lib/hooks/usePermission'
import { PermissionGate } from '@/components/ui/PermissionGate'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: number
  name: string
  code: string
  barcode?: string | null
  unit: string
  costPrice: number
  salePrice: number
  description?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
  nhanhId?: string | null
  category?: { id: number; name: string } | null
  inventoryItems?: { quantity: number }[]
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm là bắt buộc').max(200),
  code: z.string().min(1, 'Mã SKU là bắt buộc').max(50),
  barcode: z.string().optional(),
  unit: z.string().default('Cái'),
  costPrice: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).default(0),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).default('ACTIVE'),
})

type ProductForm = z.infer<typeof productSchema>

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Hoạt động', color: 'bg-green-50 text-green-700' },
  INACTIVE: { label: 'Ngừng bán', color: 'bg-gray-100 text-gray-600' },
  OUT_OF_STOCK: { label: 'Hết hàng', color: 'bg-red-50 text-red-600' },
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const ProductModal = ({
  product,
  onClose,
  onSuccess,
}: {
  product?: Product | null
  onClose: () => void
  onSuccess: () => void
}) => {
  const isEdit = !!product
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          code: product.code,
          barcode: product.barcode || '',
          unit: product.unit,
          costPrice: product.costPrice,
          salePrice: product.salePrice,
          description: product.description || '',
          status: product.status,
        }
      : { unit: 'Cái', costPrice: 0, salePrice: 0, status: 'ACTIVE' },
  })

  const handleSave = async (data: ProductForm) => {
    const payload = {
      ...data,
      barcode: data.barcode || null,
      description: data.description || null,
    }
    if (isEdit) {
      await api.put(`/products/${product.id}`, payload)
    } else {
      await api.post('/products', payload)
    }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-xl bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
          {/* Name */}
          <Field label="Tên sản phẩm *" error={errors.name?.message}>
            <input
              {...register('name')}
              placeholder="VD: Bánh mì Thuận Chay"
              className={inputCls}
            />
          </Field>

          {/* Code + Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã SKU *" error={errors.code?.message}>
              <input
                {...register('code')}
                placeholder="VD: SP001"
                className={inputCls}
                disabled={isEdit}
              />
            </Field>
            <Field label="Barcode" error={errors.barcode?.message}>
              <input {...register('barcode')} placeholder="Tùy chọn" className={inputCls} />
            </Field>
          </div>

          {/* Unit + Status */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Đơn vị tính" error={errors.unit?.message}>
              <input {...register('unit')} placeholder="Cái" className={inputCls} />
            </Field>
            <Field label="Trạng thái" error={errors.status?.message}>
              <select {...register('status')} className={inputCls}>
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Ngừng bán</option>
                <option value="OUT_OF_STOCK">Hết hàng</option>
              </select>
            </Field>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá nhập (đ)" error={errors.costPrice?.message}>
              <input
                type="number"
                {...register('costPrice')}
                placeholder="0"
                min={0}
                className={inputCls}
              />
            </Field>
            <Field label="Giá bán (đ)" error={errors.salePrice?.message}>
              <input
                type="number"
                {...register('salePrice')}
                placeholder="0"
                min={0}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Description */}
          <Field label="Mô tả" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Mô tả sản phẩm (tùy chọn)"
              className={`${inputCls} resize-none`}
            />
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const Field = ({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) => (
  <div className="space-y-1">
    <label className="text-sm font-medium">{label}</label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<{ open: boolean; product?: Product | null }>({ open: false })
  const canCreate = usePermission('products', 'create')
  const canUpdate = usePermission('products', 'update')

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search],
    queryFn: () =>
      api.get('/products', { params: { page, limit: 20, search } }).then((r) => r.data),
    keepPreviousData: true,
  })

  const syncMutation = useMutation({
    mutationFn: (id: number) => api.post(`/products/${id}/sync-nhanhvn`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const products: Product[] = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm sản phẩm, SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-9 w-72 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <PermissionGate module="products" action="create">
          <button
            onClick={() => setModal({ open: true, product: null })}
            className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Thêm sản phẩm
          </button>
        </PermissionGate>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                <th className="p-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Giá bán</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Tồn kho</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Trạng thái</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Nhanh.vn</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Thao tác</th>
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
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Không có sản phẩm nào
                    {canCreate && (
                      <button
                        onClick={() => setModal({ open: true, product: null })}
                        className="ml-2 text-primary underline hover:no-underline"
                      >
                        Thêm ngay
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const status = STATUS_MAP[p.status] || { label: p.status, color: 'bg-gray-100 text-gray-600' }
                  const totalQty = p.inventoryItems?.reduce((s, i) => s + i.quantity, 0) || 0
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category?.name || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{p.code}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(p.salePrice)}</td>
                      <td className="p-3 text-center">
                        <span className={totalQty <= 5 ? 'font-bold text-red-600' : ''}>{totalQty}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {p.nhanhId ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{p.nhanhId}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <PermissionGate module="products" action="update">
                            <button
                              onClick={() => setModal({ open: true, product: p })}
                              aria-label="Chỉnh sửa"
                              title="Chỉnh sửa"
                              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>
                          <PermissionGate module="products" action="sync">
                            <button
                              onClick={() => syncMutation.mutate(p.id)}
                              disabled={syncMutation.isPending}
                              aria-label="Sync với nhanh.vn"
                              title="Sync nhanh.vn"
                              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Hiển thị {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} trong{' '}
              {pagination.total} sản phẩm
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-muted-foreground">
                Trang {page}/{pagination.totalPages}
              </span>
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <ProductModal
          product={modal.product}
          onClose={() => setModal({ open: false })}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}
