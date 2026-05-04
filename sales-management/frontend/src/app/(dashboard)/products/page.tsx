'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Search, RefreshCw, Pencil, Loader2, ChevronLeft, ChevronRight,
  Package, LayoutGrid, Filter,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { usePermission } from '@/lib/hooks/usePermission'
import { PermissionGate } from '@/components/ui/PermissionGate'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'

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
  categoryId?: number | null
  inventoryItems?: { quantity: number }[]
}

type Category = { id: number; name: string }

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
  categorySelect: z.string().optional(),
})

type ProductForm = z.infer<typeof productSchema>

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Hoạt động', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' },
  INACTIVE: { label: 'Ngừng bán', color: 'bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground' },
  OUT_OF_STOCK: { label: 'Hết hàng', color: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' },
}

const STEPS = [
  { id: 0, title: 'Thông tin cơ bản', hint: 'Tên, mã SKU và đơn vị' },
  { id: 1, title: 'Giá & trạng thái', hint: 'Giá nhập, giá bán, kinh doanh' },
  { id: 2, title: 'Danh mục & mô tả', hint: 'Phân loại và ghi chú' },
] as const

const DEFAULT_PRODUCT_FORM: ProductForm = {
  name: '',
  code: '',
  barcode: '',
  unit: 'Cái',
  costPrice: 0,
  salePrice: 0,
  description: '',
  status: 'ACTIVE',
  categorySelect: '',
}

const inputCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const Field = ({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label}</label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)

// ─── Modal ────────────────────────────────────────────────────────────────────

const ProductModal = ({
  open,
  product,
  categories,
  onClose,
  onSuccess,
}: {
  open: boolean
  product?: Product | null
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) => {
  const isEdit = !!product
  const [step, setStep] = useState(0)

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    shouldUnregister: false,
    defaultValues: DEFAULT_PRODUCT_FORM,
  })

  useEffect(() => {
    if (!open) return
    setStep(0)
    reset(
      product
        ? {
            name: product.name,
            code: product.code,
            barcode: product.barcode || '',
            unit: product.unit,
            costPrice: product.costPrice,
            salePrice: product.salePrice,
            description: product.description || '',
            status: product.status,
            categorySelect: product.category?.id ? String(product.category.id) : '',
          }
        : DEFAULT_PRODUCT_FORM
    )
  }, [open, product?.id, reset])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep(0)
      onClose()
    }
  }

  const validateStep = async (s: number) => {
    if (s === 0) return trigger(['name', 'code', 'barcode', 'unit'])
    if (s === 1) return trigger(['costPrice', 'salePrice', 'status'])
    return true
  }

  const handleNext = async () => {
    const ok = await validateStep(step)
    if (ok && step < STEPS.length - 1) setStep((x) => x + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep((x) => x - 1)
  }

  const handleSave = async (data: ProductForm) => {
    try {
      const categoryId = data.categorySelect ? parseInt(data.categorySelect, 10) : null
      const payload = {
        name: data.name,
        code: data.code,
        barcode: data.barcode || null,
        unit: data.unit,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        description: data.description || null,
        status: data.status,
        categoryId,
      }
      if (isEdit) {
        await api.put(`/products/${product.id}`, payload)
        toast.success('Đã cập nhật sản phẩm')
      } else {
        await api.post('/products', payload)
        toast.success('Đã tạo sản phẩm mới')
      }
      reset()
      setStep(0)
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg || 'Không lưu được, thử lại sau')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          if (!isEdit && step === 0) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
          <DialogDescription>
            {STEPS[step].hint} — Bước {step + 1}/{STEPS.length}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={async () => {
                if (i <= step || (await validateStep(step))) setStep(i)
              }}
              className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs transition-colors ${
                i === step
                  ? 'border-primary bg-primary/10 font-semibold text-primary'
                  : i < step
                  ? 'border-border bg-muted/50 text-muted-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/50'
              }`}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="block truncate">{s.title}</span>
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit(handleSave)}
          className="space-y-4 pt-1"
          id="product-form"
        >
          {step === 0 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Field label="Tên sản phẩm *" error={errors.name?.message}>
                <input {...register('name')} placeholder="VD: Bánh mì Thuận Chay" className={inputCls} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Đơn vị tính" error={errors.unit?.message}>
                <input {...register('unit')} placeholder="Cái, kg, thùng..." className={inputCls} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Giá nhập (đ) *" error={errors.costPrice?.message}>
                  <input type="number" {...register('costPrice')} min={0} placeholder="0" className={inputCls} />
                </Field>
                <Field label="Giá bán (đ) *" error={errors.salePrice?.message}>
                  <input type="number" {...register('salePrice')} min={0} placeholder="0" className={inputCls} />
                </Field>
              </div>
              <Field label="Trạng thái kinh doanh" error={errors.status?.message}>
                <select {...register('status')} className={inputCls}>
                  <option value="ACTIVE">Đang bán — hoạt động</option>
                  <option value="INACTIVE">Ngừng bán</option>
                  <option value="OUT_OF_STOCK">Tạm hết hàng</option>
                </select>
              </Field>
              <p className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Giá nhập dùng để tính lãi và báo cáo; giá bán hiển thị khi tạo đơn.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Field label="Danh mục">
                <select {...register('categorySelect')} className={inputCls}>
                  <option value="">— Chưa phân loại —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mô tả" error={errors.description?.message}>
                <textarea
                  {...register('description')}
                  rows={4}
                  placeholder="Mô tả ngắn, ghi chú nội bộ..."
                  className={`${inputCls} min-h-[100px] resize-none py-3`}
                />
              </Field>
            </div>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Hủy
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Quay lại
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Tiếp theo
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  form="product-form"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                </button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modal, setModal] = useState<{ open: boolean; product?: Product | null }>({ open: false })
  const canCreate = usePermission('products', 'create')

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/products/categories').then((r) => r.data.data as Category[]),
    staleTime: 60_000,
  })

  const categories = categoriesData || []

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, statusFilter, categoryFilter],
    queryFn: () =>
      api
        .get('/products', {
          params: {
            page,
            limit: 20,
            search: search || undefined,
            status: statusFilter || undefined,
            categoryId: categoryFilter || undefined,
          },
        })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const syncMutation = useMutation({
    mutationFn: (id: number) => api.post(`/products/${id}/sync-nhanhvn`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Đã đồng bộ Nhanh.vn')
    },
    onError: () => toast.error('Đồng bộ thất bại'),
  })

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const products: Product[] = data?.data || []
  const pagination = data?.pagination
  const hasFilters = !!(statusFilter || categoryFilter || search)

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="flex flex-col gap-1 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Quản lý danh mục hàng hóa, giá và đồng bộ kho với Nhanh.vn.
          </p>
        </div>
        {pagination && pagination.total > 0 && (
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            {pagination.total} sản phẩm
            {hasFilters && ' (đã lọc)'}
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm tên, SKU, barcode..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Tìm sản phẩm"
              className="h-10 w-full min-w-[220px] rounded-lg border border-input bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:w-72"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="h-8 max-w-[140px] border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
              aria-label="Lọc trạng thái"
            >
              <option value="">Mọi trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng bán</option>
              <option value="OUT_OF_STOCK">Hết hàng</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="h-8 max-w-[180px] border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
              aria-label="Lọc danh mục"
            >
              <option value="">Mọi danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <PermissionGate module="products" action="create">
          <button
            type="button"
            onClick={() => setModal({ open: true, product: null })}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Thêm sản phẩm
          </button>
        </PermissionGate>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="p-3 text-left font-semibold text-muted-foreground">Sản phẩm</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">SKU</th>
                <th className="hidden p-3 text-left font-semibold text-muted-foreground md:table-cell">
                  Danh mục
                </th>
                <th className="p-3 text-right font-semibold text-muted-foreground">Giá bán</th>
                <th className="p-3 text-center font-semibold text-muted-foreground">Tồn</th>
                <th className="p-3 text-center font-semibold text-muted-foreground">Trạng thái</th>
                <th className="hidden p-3 text-center font-semibold text-muted-foreground lg:table-cell">
                  Nhanh.vn
                </th>
                <th className="p-3 text-center font-semibold text-muted-foreground">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <Package className="h-10 w-10 text-muted-foreground/50" aria-hidden />
                      <p className="text-muted-foreground">Chưa có sản phẩm phù hợp bộ lọc.</p>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => setModal({ open: true, product: null })}
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Thêm sản phẩm đầu tiên
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const status = STATUS_MAP[p.status] || {
                    label: p.status,
                    color: 'bg-gray-100 text-gray-600',
                  }
                  const totalQty = p.inventoryItems?.reduce((s, i) => s + i.quantity, 0) || 0
                  return (
                    <tr key={p.id} className="border-b border-border/50 transition-colors hover:bg-accent/50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="truncate text-xs text-muted-foreground md:hidden">
                              {p.category?.name || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{p.code}</td>
                      <td className="hidden p-3 text-muted-foreground md:table-cell">
                        {p.category?.name || '—'}
                      </td>
                      <td className="p-3 text-right font-semibold tabular-nums">{formatCurrency(p.salePrice)}</td>
                      <td className="p-3 text-center tabular-nums">
                        <span className={totalQty <= 5 ? 'font-semibold text-red-600' : ''}>{totalQty}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="hidden p-3 text-center lg:table-cell">
                        {p.nhanhId ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                            {p.nhanhId}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <PermissionGate module="products" action="update">
                            <button
                              type="button"
                              onClick={() => setModal({ open: true, product: p })}
                              aria-label={`Chỉnh sửa ${p.name}`}
                              title="Chỉnh sửa"
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </PermissionGate>
                          <PermissionGate module="products" action="sync">
                            <button
                              type="button"
                              onClick={() => syncMutation.mutate(p.id)}
                              disabled={syncMutation.isPending}
                              aria-label="Đồng bộ Nhanh.vn"
                              title="Đồng bộ Nhanh.vn"
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                            >
                              <RefreshCw className="h-4 w-4" />
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

        {pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Hiển thị {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} / {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <span className="tabular-nums text-muted-foreground">
                {page}/{pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductModal
        open={modal.open}
        product={modal.product}
        categories={categories}
        onClose={() => setModal({ open: false })}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
