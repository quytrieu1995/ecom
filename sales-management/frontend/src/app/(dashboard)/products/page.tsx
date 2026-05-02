'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { usePermission } from '@/lib/hooks/usePermission'
import { PermissionGate } from '@/components/ui/PermissionGate'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Hoạt động', color: 'bg-green-50 text-green-700' },
  INACTIVE: { label: 'Ngừng bán', color: 'bg-gray-100 text-gray-600' },
  OUT_OF_STOCK: { label: 'Hết hàng', color: 'bg-red-50 text-red-600' },
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const canCreate = usePermission('products', 'create')

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

  const products = data?.data || []
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
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-9 w-72 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <PermissionGate module="products" action="create">
          <button className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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
                  </td>
                </tr>
              ) : (
                products.map((p: any) => {
                  const status = STATUS_MAP[p.status] || { label: p.status, color: 'bg-gray-100 text-gray-600' }
                  const totalQty = p.inventoryItems?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                              N/A
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category?.name}</p>
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
                        <div className="flex items-center justify-center gap-2">
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
        {pagination && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Hiển thị {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} trong {pagination.total} sản phẩm
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-border px-3 py-1 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-muted-foreground">Trang {page}/{pagination.totalPages}</span>
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
    </div>
  )
}
