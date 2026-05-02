'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PermissionGate } from '@/components/ui/PermissionGate'

export default function CustomersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, type],
    queryFn: () =>
      api.get('/customers', { params: { page, limit: 20, search, type: type || undefined } }).then((r) => r.data),
    keepPreviousData: true,
  })

  const customers = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tên, SĐT, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-9 w-60 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả loại KH</option>
            <option value="RETAIL">Bán lẻ</option>
            <option value="WHOLESALE">Bán buôn</option>
          </select>
        </div>

        <PermissionGate module="customers" action="create">
          <button className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Thêm khách hàng
          </button>
        </PermissionGate>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Mã KH</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Tên</th>
                <th className="p-3 text-left font-medium text-muted-foreground">SĐT</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Loại</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Tổng đơn</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Tổng chi tiêu</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Không có khách hàng nào</td></tr>
              ) : (
                customers.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-accent/40 cursor-pointer">
                    <td className="p-3 font-mono text-xs">{c.code}</td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3">{c.phone || '—'}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.type === 'WHOLESALE' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {c.type === 'WHOLESALE' ? 'Buôn' : 'Lẻ'}
                      </span>
                    </td>
                    <td className="p-3 text-right">{c.totalOrders}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(c.totalSpent)}</td>
                    <td className="p-3 text-muted-foreground">{formatDateTime(c.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">Tổng: {pagination.total} khách hàng</p>
            <div className="flex items-center gap-2">
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Trước</button>
              <span className="text-muted-foreground">{page}/{pagination.totalPages}</span>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Sau</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
