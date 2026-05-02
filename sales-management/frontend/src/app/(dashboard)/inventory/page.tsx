'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Package, ArrowDown, ArrowUp, Clock, SlidersHorizontal,
  Search, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stock',   label: 'Tồn kho',     icon: Package },
  { id: 'import',  label: 'Nhập hàng',   icon: ArrowDown },
  { id: 'export',  label: 'Xuất hàng',   icon: ArrowUp },
  { id: 'adjust',  label: 'Điều chỉnh',  icon: SlidersHorizontal },
  { id: 'history', label: 'Lịch sử',     icon: Clock },
] as const

type TabId = typeof TABS[number]['id']

const TYPE_META: Record<string, { label: string; color: string }> = {
  IMPORT:   { label: 'Nhập kho',    color: 'bg-green-50 text-green-700' },
  EXPORT:   { label: 'Xuất kho',    color: 'bg-red-50 text-red-700' },
  ADJUST:   { label: 'Điều chỉnh', color: 'bg-yellow-50 text-yellow-700' },
  TRANSFER: { label: 'Chuyển kho', color: 'bg-blue-50 text-blue-700' },
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ─── Shared hooks ────────────────────────────────────────────────────────────

const useWarehouses = () =>
  useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/inventory/warehouses').then((r) => r.data.data),
    staleTime: 300_000,
  })

const useProductSearch = (search: string) =>
  useQuery({
    queryKey: ['products-inv-search', search],
    queryFn: () =>
      api.get('/products', { params: { search, limit: 8, status: 'ACTIVE' } }).then((r) => r.data.data),
    enabled: search.length >= 1,
  })

// ─── Inventory form schema ────────────────────────────────────────────────────

const txSchema = z.object({
  productId:   z.number({ required_error: 'Chọn sản phẩm' }),
  productName: z.string(),
  warehouseId: z.coerce.number({ required_error: 'Chọn kho' }),
  quantity:    z.coerce.number().int().min(1, 'Số lượng tối thiểu 1'),
  note:        z.string().optional(),
})

const adjustSchema = z.object({
  productId:   z.number({ required_error: 'Chọn sản phẩm' }),
  productName: z.string(),
  warehouseId: z.coerce.number({ required_error: 'Chọn kho' }),
  newQuantity: z.coerce.number().int().min(0, 'Không âm'),
  note:        z.string().optional(),
})

type TxForm     = z.infer<typeof txSchema>
type AdjustForm = z.infer<typeof adjustSchema>

// ─── Product picker ───────────────────────────────────────────────────────────

const ProductPicker = ({
  value,
  onSelect,
}: {
  value: string
  onSelect: (id: number, name: string) => void
}) => {
  const [search, setSearch] = useState(value)
  const [open, setOpen] = useState(false)
  const { data: products } = useProductSearch(search)

  const handleSelect = (p: any) => {
    onSelect(p.id, p.name)
    setSearch(p.name)
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm sản phẩm theo tên hoặc SKU..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className={`${inputCls} pl-9`}
        />
      </div>
      {open && (products as any[])?.length ? (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          {(products as any[]).map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => handleSelect(p)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
            >
              <span>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{p.code}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────

const Alert = ({ type, msg }: { type: 'success' | 'error'; msg: string }) => (
  <div
    className={`flex items-center gap-2 rounded-md p-3 text-sm ${
      type === 'success'
        ? 'bg-green-50 text-green-700'
        : 'bg-red-50 text-red-700'
    }`}
  >
    {type === 'success' ? (
      <CheckCircle2 className="h-4 w-4 shrink-0" />
    ) : (
      <AlertTriangle className="h-4 w-4 shrink-0" />
    )}
    {msg}
  </div>
)

// ─── Import / Export Form ─────────────────────────────────────────────────────

const ImportExportForm = ({ type }: { type: 'IMPORT' | 'EXPORT' }) => {
  const qc = useQueryClient()
  const { data: warehouses } = useWarehouses()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const {
    register, handleSubmit, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<TxForm>({ resolver: zodResolver(txSchema) })

  const endpoint = type === 'IMPORT' ? '/inventory/import' : '/inventory/export'

  const onSubmit = async (data: TxForm) => {
    setFeedback(null)
    try {
      await api.post(endpoint, {
        productId:   data.productId,
        warehouseId: data.warehouseId,
        quantity:    data.quantity,
        note:        data.note,
      })
      setFeedback({ ok: true, msg: `${type === 'IMPORT' ? 'Nhập' : 'Xuất'} kho thành công!` })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
      reset()
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.response?.data?.message || 'Thao tác thất bại' })
    }
  }

  const isImport = type === 'IMPORT'
  const accent = isImport ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
  const icon = isImport ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6">
      <h3 className="mb-5 flex items-center gap-2 text-base font-semibold">
        {icon}
        {isImport ? 'Phiếu nhập kho' : 'Phiếu xuất kho'}
      </h3>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Product */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Sản phẩm *</label>
          <ProductPicker
            value=""
            onSelect={(id, name) => { setValue('productId', id); setValue('productName', name) }}
          />
          {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
        </div>

        {/* Warehouse */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Kho *</label>
          <select {...register('warehouseId')} className={inputCls}>
            <option value="">-- Chọn kho --</option>
            {(warehouses as any[] | undefined)?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {errors.warehouseId && <p className="text-xs text-destructive">{errors.warehouseId.message}</p>}
        </div>

        {/* Quantity */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Số lượng *</label>
          <input type="number" {...register('quantity')} min={1} placeholder="0" className={inputCls} />
          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
        </div>

        {/* Note */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Ghi chú</label>
          <textarea
            {...register('note')}
            rows={2}
            placeholder="Lý do nhập/xuất kho..."
            className={`${inputCls} h-auto resize-none py-2`}
          />
        </div>

        {feedback && <Alert type={feedback.ok ? 'success' : 'error'} msg={feedback.msg} />}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-60 ${accent}`}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {icon}
          {isImport ? 'Xác nhận nhập kho' : 'Xác nhận xuất kho'}
        </button>
      </form>
    </div>
  )
}

// ─── Adjust Form ─────────────────────────────────────────────────────────────

const AdjustForm = () => {
  const qc = useQueryClient()
  const { data: warehouses } = useWarehouses()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustForm>({ resolver: zodResolver(adjustSchema) })

  const onSubmit = async (data: AdjustForm) => {
    setFeedback(null)
    try {
      await api.post('/inventory/adjust', {
        productId:   data.productId,
        warehouseId: data.warehouseId,
        newQuantity: data.newQuantity,
        note:        data.note,
      })
      setFeedback({ ok: true, msg: 'Điều chỉnh tồn kho thành công!' })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
      reset()
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.response?.data?.message || 'Điều chỉnh thất bại' })
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6">
      <h3 className="mb-5 flex items-center gap-2 text-base font-semibold">
        <SlidersHorizontal className="h-4 w-4" />
        Điều chỉnh / Thanh hủy tồn kho
      </h3>

      <div className="mb-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
        <strong>Lưu ý:</strong> Điều chỉnh sẽ đặt tồn kho về số lượng mới được nhập.
        Dùng khi kiểm kho, thanh hủy hàng hỏng, hoặc điều chỉnh số liệu sai.
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Product */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Sản phẩm *</label>
          <ProductPicker
            value=""
            onSelect={(id, name) => { setValue('productId', id); setValue('productName', name) }}
          />
          {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
        </div>

        {/* Warehouse */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Kho *</label>
          <select {...register('warehouseId')} className={inputCls}>
            <option value="">-- Chọn kho --</option>
            {(warehouses as any[] | undefined)?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {errors.warehouseId && <p className="text-xs text-destructive">{errors.warehouseId.message}</p>}
        </div>

        {/* New Quantity */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Số lượng mới (thực tế) *</label>
          <input
            type="number"
            {...register('newQuantity')}
            min={0}
            placeholder="Nhập số lượng thực tế sau kiểm kho"
            className={inputCls}
          />
          {errors.newQuantity && <p className="text-xs text-destructive">{errors.newQuantity.message}</p>}
        </div>

        {/* Note */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Lý do *</label>
          <textarea
            {...register('note')}
            rows={2}
            placeholder="VD: Kiểm kho định kỳ, Thanh hủy hàng hết hạn..."
            className={`${inputCls} h-auto resize-none py-2`}
          />
        </div>

        {feedback && <Alert type={feedback.ok ? 'success' : 'error'} msg={feedback.msg} />}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-yellow-600 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <SlidersHorizontal className="h-4 w-4" />
          Xác nhận điều chỉnh
        </button>
      </form>
    </div>
  )
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────

const StockTab = () => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, search],
    queryFn: () =>
      api.get('/inventory', { params: { page, limit: 20 } }).then((r) => r.data),
    keepPreviousData: true,
  })

  const items: any[] = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                <th className="p-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Kho</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Tồn kho</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Tối thiểu</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    Chưa có dữ liệu tồn kho
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isLow = item.quantity <= item.minQuantity
                  const isOut = item.quantity === 0
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3 font-medium">{item.product?.name}</td>
                      <td className="p-3 font-mono text-xs">{item.variant?.sku || item.product?.code}</td>
                      <td className="p-3">{item.warehouse?.name}</td>
                      <td className={`p-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>
                        {item.quantity}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{item.minQuantity}</td>
                      <td className="p-3 text-center">
                        {isOut ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Hết hàng
                          </span>
                        ) : isLow ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Sắp hết
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Đủ hàng
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">Tổng: {pagination.total} mặt hàng</p>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-muted-foreground">Trang {page}/{pagination.totalPages}</span>
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
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────

const HistoryTab = () => {
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-transactions', page, type],
    queryFn: () =>
      api
        .get('/inventory/transactions', { params: { page, limit: 30, type: type || undefined } })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const transactions: any[] = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tất cả loại</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Loại</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Kho</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Số lượng</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Trước</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Sau</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Ghi chú</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Thời gian</th>
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Chưa có giao dịch kho nào
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const meta = TYPE_META[t.type] || { label: t.type, color: 'bg-gray-100 text-gray-700' }
                  const isPositive = t.quantity > 0
                  return (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{t.product?.name}</td>
                      <td className="p-3 text-muted-foreground">{t.warehouse?.name}</td>
                      <td className={`p-3 text-right font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? `+${t.quantity}` : t.quantity}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{t.previousQty}</td>
                      <td className="p-3 text-right font-semibold">{t.newQty}</td>
                      <td className="p-3 max-w-[160px] truncate text-xs text-muted-foreground" title={t.note}>
                        {t.note || '—'}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(t.createdAt)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">Tổng: {pagination.total} giao dịch</p>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-muted-foreground">Trang {page}/{pagination.totalPages}</span>
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
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<TabId>('stock')

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-selected={tab === id}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'stock'   && <StockTab />}
      {tab === 'import'  && <ImportExportForm type="IMPORT" />}
      {tab === 'export'  && <ImportExportForm type="EXPORT" />}
      {tab === 'adjust'  && <AdjustForm />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}
