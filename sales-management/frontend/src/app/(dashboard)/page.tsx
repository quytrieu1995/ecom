'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingCart, AlertTriangle, Users } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xử lý', color: 'text-yellow-600 bg-yellow-50' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-blue-600 bg-blue-50' },
  PROCESSING: { label: 'Đang xử lý', color: 'text-indigo-600 bg-indigo-50' },
  SHIPPING: { label: 'Đang giao', color: 'text-purple-600 bg-purple-50' },
  DELIVERED: { label: 'Đã giao', color: 'text-green-600 bg-green-50' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-600 bg-red-50' },
}

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: salesData } = useQuery({
    queryKey: ['sales-chart'],
    queryFn: () =>
      api.get('/reports/sales', {
        params: { period: 'day', startDate: new Date(Date.now() - 7 * 86400000).toISOString() },
      }).then((r) => r.data.data),
  })

  const { data: topProducts } = useQuery({
    queryKey: ['top-products'],
    queryFn: () =>
      api.get('/reports/products', { params: { limit: 5 } }).then((r) => r.data.data),
  })

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Đơn hàng hôm nay"
          value={dashboard?.kpi.todayOrders ?? '—'}
          icon={ShoppingCart}
          color="text-blue-600 bg-blue-50 dark:bg-blue-950"
          loading={isLoading}
        />
        <KpiCard
          title="Doanh thu hôm nay"
          value={dashboard?.kpi.todayRevenue != null ? formatCurrency(dashboard.kpi.todayRevenue) : '—'}
          icon={TrendingUp}
          color="text-green-600 bg-green-50 dark:bg-green-950"
          loading={isLoading}
        />
        <KpiCard
          title="Sắp hết hàng"
          value={dashboard?.kpi.lowStockCount ?? '—'}
          icon={AlertTriangle}
          color="text-amber-600 bg-amber-50 dark:bg-amber-950"
          loading={isLoading}
        />
        <KpiCard
          title="Khách hàng mới"
          value={dashboard?.kpi.newCustomers ?? '—'}
          icon={Users}
          color="text-indigo-600 bg-indigo-50 dark:bg-indigo-950"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue line chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Doanh thu 7 ngày qua</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={salesData || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} name="Doanh thu" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top products bar chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Top 5 sản phẩm bán chạy</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProducts || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="productId" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="_sum.quantity" fill="#6366f1" radius={[4, 4, 0, 0]} name="SL bán" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Đơn hàng mới nhất</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-medium text-muted-foreground">Mã đơn</th>
                <th className="pb-2 text-left font-medium text-muted-foreground">Khách hàng</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Tổng tiền</th>
                <th className="pb-2 text-center font-medium text-muted-foreground">Trạng thái</th>
                <th className="pb-2 text-left font-medium text-muted-foreground">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.recentOrders?.map((order: any) => {
                const status = ORDER_STATUS_LABELS[order.status] || { label: order.status, color: 'text-gray-600 bg-gray-50' }
                return (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td className="py-2.5 font-mono text-xs">{order.code}</td>
                    <td className="py-2.5">{order.customer?.name || 'Khách lẻ'}</td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(order.total)}</td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                  </tr>
                )
              })}
              {!dashboard?.recentOrders?.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Chưa có đơn hàng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const KpiCard = ({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  loading: boolean
}) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="mt-3 text-2xl font-bold">
      {loading ? <span className="h-6 w-24 animate-pulse rounded bg-muted inline-block" /> : value}
    </p>
  </div>
)
