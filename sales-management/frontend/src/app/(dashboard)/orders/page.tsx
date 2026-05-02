'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PermissionGate } from '@/components/ui/PermissionGate'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xử lý', color: 'bg-yellow-50 text-yellow-700' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-50 text-blue-700' },
  PROCESSING: { label: 'Đang xử lý', color: 'bg-indigo-50 text-indigo-700' },
  SHIPPING: { label: 'Đang giao', color: 'bg-purple-50 text-purple-700' },
  DELIVERED: { label: 'Đã giao', color: 'bg-green-50 text-green-700' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-50 text-red-700' },
  RETURNED: { label: 'Trả hàng', color: 'bg-gray-100 text-gray-700' },
}

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, status],
    queryFn: () =>
      api.get('/orders', { params: { page, limit: 20, search, status: status || undefined } }).then((r) => r.data),
    keepPreviousData: true,
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
          <button className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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
                <th className="p-3 text-center font-medium text-muted-foreground">TT thanh toán</th>
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
                      <td key={j} className="p-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Không có đơn hàng nào</td></tr>
              ) : (
                orders.map((order: any) => {
                  const s = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-accent/40 cursor-pointer">
                      <td className="p-3 font-mono text-xs font-medium">{order.code}</td>
                      <td className="p-3">{order.customer?.name || 'Khách lẻ'}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(order.total)}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          order.paymentStatus === 'PAID' ? 'bg-green-50 text-green-700'
                          : order.paymentStatus === 'PARTIAL' ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-red-50 text-red-700'
                        }`}>
                          {order.paymentStatus === 'PAID' ? 'Đã TT' : order.paymentStatus === 'PARTIAL' ? 'Một phần' : 'Chưa TT'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
                      </td>
                      <td className="p-3 text-center">
                        {order.nhanhId ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">nhanh.vn</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Local</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
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
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Trước</button>
              <span className="text-muted-foreground">Trang {page}/{pagination.totalPages}</span>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-3 py-1 hover:bg-accent disabled:opacity-40">Sau</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
