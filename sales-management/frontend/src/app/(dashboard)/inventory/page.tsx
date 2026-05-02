'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, ArrowDown, ArrowUp, Clock } from 'lucide-react'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { PermissionGate } from '@/components/ui/PermissionGate'

const TABS = [
  { id: 'stock', label: 'Tồn kho', icon: Package },
  { id: 'import', label: 'Nhập kho', icon: ArrowDown },
  { id: 'export', label: 'Xuất kho', icon: ArrowUp },
  { id: 'history', label: 'Lịch sử', icon: Clock },
] as const

export default function InventoryPage() {
  const [tab, setTab] = useState<'stock' | 'import' | 'export' | 'history'>('stock')

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-selected={tab === id}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab />}
      {tab === 'import' && <ImportExportForm type="IMPORT" />}
      {tab === 'export' && <ImportExportForm type="EXPORT" />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

const StockTab = () => {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page],
    queryFn: () => api.get('/inventory', { params: { page, limit: 20 } }).then((r) => r.data),
    keepPreviousData: true,
  })

  const items = data?.data || []

  return (
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="p-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Chưa có dữ liệu tồn kho</td></tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="p-3 font-medium">{item.product?.name}</td>
                  <td className="p-3 font-mono text-xs">{item.variant?.sku || item.product?.code}</td>
                  <td className="p-3">{item.warehouse?.name}</td>
                  <td className={`p-3 text-right font-semibold ${item.quantity <= item.minQuantity ? 'text-red-600' : ''}`}>
                    {item.quantity}
                    {item.quantity <= item.minQuantity && (
                      <span className="ml-1 text-xs text-red-500">⚠️</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">{item.minQuantity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ImportExportForm = ({ type }: { type: 'IMPORT' | 'EXPORT' }) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
      <h3 className="mb-4 font-semibold">{type === 'IMPORT' ? 'Phiếu nhập kho' : 'Phiếu xuất kho'}</h3>
      <p className="text-sm text-muted-foreground">
        Tính năng {type === 'IMPORT' ? 'nhập' : 'xuất'} kho sẽ được triển khai trong PHASE 2.
      </p>
    </div>
  )
}

const HistoryTab = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: () => api.get('/inventory/transactions', { params: { limit: 50 } }).then((r) => r.data),
  })

  const TYPE_LABELS: Record<string, string> = {
    IMPORT: 'Nhập kho',
    EXPORT: 'Xuất kho',
    ADJUST: 'Điều chỉnh',
    TRANSFER: 'Chuyển kho',
  }

  return (
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
              <th className="p-3 text-left font-medium text-muted-foreground">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((t: any) => (
              <tr key={t.id} className="border-b border-border/50 hover:bg-accent/40">
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.type === 'IMPORT' ? 'bg-green-50 text-green-700'
                    : t.type === 'EXPORT' ? 'bg-red-50 text-red-700'
                    : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {TYPE_LABELS[t.type]}
                  </span>
                </td>
                <td className="p-3">{t.product?.name}</td>
                <td className="p-3">{t.warehouse?.name}</td>
                <td className="p-3 text-right font-medium">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                <td className="p-3 text-right text-muted-foreground">{t.previousQty}</td>
                <td className="p-3 text-right font-semibold">{t.newQty}</td>
                <td className="p-3 text-muted-foreground">{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
