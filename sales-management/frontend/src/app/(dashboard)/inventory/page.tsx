'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Package, ArrowDown, ArrowUp, Clock, SlidersHorizontal,
  Search, Loader2, CheckCircle2, AlertTriangle, Plus, Trash2, Hash,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string
  productId: number | null
  productName: string
  productCode: string
  quantity: number
  note: string
}

const newLine = (): LineItem => ({
  id: crypto.randomUUID(),
  productId: null,
  productName: '',
  productCode: '',
  quantity: 1,
  note: '',
})

// ─── Shared hooks ─────────────────────────────────────────────────────────────

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

// ─── Product picker (inline per row) ─────────────────────────────────────────

const InlineProductPicker = ({
  value,
  onSelect,
}: {
  value: string
  onSelect: (id: number, name: string, code: string) => void
}) => {
  const [search, setSearch] = useState(value)
  const [open, setOpen] = useState(false)
  const { data: products } = useProductSearch(search)

  const handleSelect = (p: any) => {
    onSelect(p.id, p.name, p.code)
    setSearch(p.name)
    setOpen(false)
  }

  return (
    <div className="relative min-w-0">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm sản phẩm..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex h-9 w-full rounded-md border border-input bg-background pl-7 pr-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {open && (products as any[])?.length ? (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-border bg-card shadow-lg">
          {(products as any[]).map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => handleSelect(p)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <span className="font-medium truncate">{p.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground shrink-0">{p.code}</span>
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
      type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}
  >
    {type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
    {msg}
  </div>
)

// ─── Import / Export Form (multi-product) ─────────────────────────────────────

const ImportExportForm = ({ type }: { type: 'IMPORT' | 'EXPORT' }) => {
  const qc = useQueryClient()
  const { data: warehouses } = useWarehouses()
  const [warehouseId, setWarehouseId] = useState('')
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [batchNote, setBatchNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const isImport = type === 'IMPORT'
  const endpoint = isImport ? '/inventory/import/batch' : '/inventory/export/batch'
  const accent = isImport ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
  const accentLight = isImport ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'

  const addLine = () => setLines((prev) => [...prev, newLine()])

  const removeLine = (id: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))

  const updateLine = useCallback((id: string, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))), [])

  const totalQty = lines.reduce((s, l) => s + (l.quantity || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!warehouseId) {
      setFeedback({ ok: false, msg: 'Vui lòng chọn kho' })
      return
    }

    const validLines = lines.filter((l) => l.productId && l.quantity > 0)
    if (validLines.length === 0) {
      setFeedback({ ok: false, msg: 'Vui lòng chọn ít nhất 1 sản phẩm' })
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post(endpoint, {
        warehouseId: parseInt(warehouseId),
        note: batchNote || undefined,
        items: validLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          note: l.note || undefined,
        })),
      })
      const count = res.data.data?.[isImport ? 'imported' : 'exported'] ?? validLines.length
      setFeedback({ ok: true, msg: `${isImport ? 'Nhập' : 'Xuất'} kho thành công ${count} sản phẩm!` })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
      setLines([newLine()])
      setBatchNote('')
      setWarehouseId('')
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.response?.data?.message || 'Thao tác thất bại' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-border ${accentLight}`}>
        {isImport ? <ArrowDown className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
        <h3 className="text-base font-semibold">
          {isImport ? 'Phiếu nhập kho' : 'Phiếu xuất kho'}
        </h3>
        <span className="ml-auto text-sm font-normal opacity-70">
          {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Warehouse + batch note */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Kho hàng *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- Chọn kho --</option>
              {(warehouses as any[] | undefined)?.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Ghi chú phiếu</label>
            <input
              type="text"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              placeholder={isImport ? 'VD: Nhập từ NCC ABC...' : 'VD: Xuất cho đơn hàng...'}
              className={inputCls}
            />
          </div>
        </div>

        {/* Product lines table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-8">
                  <Hash className="h-3.5 w-3.5" />
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Sản phẩm *</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-28">Số lượng *</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-40">Ghi chú dòng</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground text-center">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <InlineProductPicker
                      value={line.productName}
                      onSelect={(id, name, code) =>
                        updateLine(line.id, { productId: id, productName: name, productCode: code })
                      }
                    />
                    {line.productCode && (
                      <span className="font-mono text-[10px] text-muted-foreground">{line.productCode}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={line.note}
                      onChange={(e) => updateLine(line.id, { note: e.target.value })}
                      placeholder="Tuỳ chọn..."
                      className={inputCls}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Xoá dòng"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add row */}
          <button
            type="button"
            onClick={addLine}
            className="flex w-full items-center justify-center gap-2 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors border-t border-dashed border-border"
          >
            <Plus className="h-4 w-4" />
            Thêm sản phẩm
          </button>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {lines.filter((l) => l.productId).length} / {lines.length} sản phẩm đã chọn
          </span>
          <span className="font-semibold">
            Tổng số lượng: <span className={isImport ? 'text-green-700' : 'text-red-700'}>{totalQty}</span>
          </span>
        </div>

        {feedback && <Alert type={feedback.ok ? 'success' : 'error'} msg={feedback.msg} />}

        <button
          type="submit"
          disabled={submitting}
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-60 ${accent}`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isImport ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />)}
          {isImport ? 'Xác nhận nhập kho' : 'Xác nhận xuất kho'}
        </button>
      </div>
    </form>
  )
}

// ─── Adjust Form ──────────────────────────────────────────────────────────────

const AdjustForm = () => {
  const qc = useQueryClient()
  const { data: warehouses } = useWarehouses()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [fields, setFields] = useState({ productId: 0, productName: '', warehouseId: '', newQuantity: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (!fields.productId || !fields.warehouseId) {
      setFeedback({ ok: false, msg: 'Vui lòng chọn sản phẩm và kho' })
      return
    }
    setSubmitting(true)
    try {
      await api.post('/inventory/adjust', {
        productId: fields.productId,
        warehouseId: parseInt(fields.warehouseId),
        newQuantity: parseInt(fields.newQuantity),
        note: fields.note,
      })
      setFeedback({ ok: true, msg: 'Điều chỉnh tồn kho thành công!' })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
      setFields({ productId: 0, productName: '', warehouseId: '', newQuantity: '', note: '' })
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.response?.data?.message || 'Điều chỉnh thất bại' })
    } finally {
      setSubmitting(false)
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

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Sản phẩm *</label>
          <InlineProductPicker
            value={fields.productName}
            onSelect={(id, name) => setFields((f) => ({ ...f, productId: id, productName: name }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Kho *</label>
          <select
            value={fields.warehouseId}
            onChange={(e) => setFields((f) => ({ ...f, warehouseId: e.target.value }))}
            className={inputCls}
          >
            <option value="">-- Chọn kho --</option>
            {(warehouses as any[] | undefined)?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Số lượng thực tế (sau điều chỉnh) *</label>
          <input
            type="number"
            value={fields.newQuantity}
            onChange={(e) => setFields((f) => ({ ...f, newQuantity: e.target.value }))}
            min={0}
            placeholder="Nhập số lượng thực tế"
            className={inputCls}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Lý do *</label>
          <textarea
            value={fields.note}
            onChange={(e) => setFields((f) => ({ ...f, note: e.target.value }))}
            rows={2}
            placeholder="VD: Kiểm kho định kỳ, Thanh hủy hàng hết hạn..."
            className={`${inputCls} h-auto resize-none py-2`}
          />
        </div>

        {feedback && <Alert type={feedback.ok ? 'success' : 'error'} msg={feedback.msg} />}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-yellow-600 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
  const [warehouseId, setWarehouseId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const { data: warehouses } = useWarehouses()

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, warehouseId, lowStockOnly],
    queryFn: () =>
      api
        .get('/inventory', {
          params: {
            page,
            limit: 20,
            warehouseId: warehouseId || undefined,
            lowStock: lowStockOnly ? 'true' : undefined,
          },
        })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const items: any[] = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="inv-wh" className="text-sm text-muted-foreground whitespace-nowrap">
              Kho
            </label>
            <select
              id="inv-wh"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value)
                setPage(1)
              }}
              className="h-10 min-w-[160px] rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tất cả kho</option>
              {(warehouses as any[] | undefined)?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked)
                setPage(1)
              }}
              className="rounded border-input"
            />
            Chỉ sắp hết / hết
          </label>
        </div>
        {pagination && pagination.total > 0 && (
          <p className="text-sm tabular-nums text-muted-foreground">{pagination.total} dòng tồn</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="p-3 text-left font-semibold text-muted-foreground">Sản phẩm</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">SKU</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">Kho</th>
                <th className="p-3 text-right font-semibold text-muted-foreground">Tồn kho</th>
                <th className="p-3 text-right font-semibold text-muted-foreground">Tối thiểu</th>
                <th className="p-3 text-center font-semibold text-muted-foreground">Trạng thái</th>
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
                  const isLow = item.quantity <= item.minQuantity && item.quantity > 0
                  const isOut = item.quantity === 0
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3 font-medium">{item.product?.name}</td>
                      <td className="p-3 font-mono text-xs">{item.variant?.sku || item.product?.code}</td>
                      <td className="p-3">{item.warehouse?.name}</td>
                      <td className={`p-3 text-right font-semibold ${isLow || isOut ? 'text-red-600' : ''}`}>
                        {item.quantity}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{item.minQuantity}</td>
                      <td className="p-3 text-center">
                        {isOut ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Hết hàng</span>
                        ) : isLow ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Sắp hết</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Đủ hàng</span>
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
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Trước</button>
              <span className="text-muted-foreground">Trang {page}/{pagination.totalPages}</span>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Sau</button>
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
      api.get('/inventory/transactions', { params: { page, limit: 30, type: type || undefined } }).then((r) => r.data),
    keepPreviousData: true,
  })

  const transactions: any[] = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
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
                      <td key={j} className="p-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">Chưa có giao dịch kho nào</td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const meta = TYPE_META[t.type] || { label: t.type, color: 'bg-gray-100 text-gray-700' }
                  const isPositive = t.quantity > 0
                  return (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="p-3 font-medium">{t.product?.name}</td>
                      <td className="p-3 text-muted-foreground">{t.warehouse?.name}</td>
                      <td className={`p-3 text-right font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? `+${t.quantity}` : t.quantity}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{t.previousQty}</td>
                      <td className="p-3 text-right font-semibold">{t.newQty}</td>
                      <td className="p-3 max-w-[160px] truncate text-xs text-muted-foreground" title={t.note}>{t.note || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
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
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Trước</button>
              <span className="text-muted-foreground">Trang {page}/{pagination.totalPages}</span>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}
                className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Sau</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<TabId>('stock')

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Xem tồn theo kho, tạo phiếu nhập / xuất nhiều dòng, điều chỉnh sau kiểm kê và tra cứu lịch sử giao dịch.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
        role="tablist"
        aria-label="Khu vực kho"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`inv-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`inv-panel-${id}`}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div id={`inv-panel-${tab}`} role="tabpanel" aria-labelledby={`inv-tab-${tab}`}>
        {tab === 'stock'   && <StockTab />}
      {tab === 'import'  && <ImportExportForm type="IMPORT" />}
      {tab === 'export'  && <ImportExportForm type="EXPORT" />}
      {tab === 'adjust'  && <AdjustForm />}
      {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
