'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const TABS = ['Tồn kho', 'Doanh thu', 'Sản phẩm', 'Khách hàng'] as const

export default function ReportsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Doanh thu')

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Doanh thu' && <SalesReport />}
      {tab === 'Tồn kho' && <InventorySummary />}
      {tab === 'Sản phẩm' && <ProductsReport />}
      {tab === 'Khách hàng' && <CustomersReport />}
    </div>
  )
}

const SalesReport = () => {
  const { data } = useQuery({
    queryKey: ['report-sales'],
    queryFn: () =>
      api.get('/reports/sales', {
        params: { period: 'day', startDate: new Date(Date.now() - 30 * 86400000).toISOString() },
      }).then((r) => r.data.data),
  })

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 font-semibold">Doanh thu 30 ngày qua</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data || []}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} name="Doanh thu" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const InventorySummary = () => {
  const { data } = useQuery({
    queryKey: ['report-inventory'],
    queryFn: () => api.get('/reports/inventory-summary').then((r) => r.data.data),
  })

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
            </tr>
          </thead>
          <tbody>
            {data?.map((item: any) => (
              <tr key={item.id} className="border-b border-border/50 hover:bg-accent/40">
                <td className="p-3">{item.product?.name}</td>
                <td className="p-3 font-mono text-xs">{item.product?.code}</td>
                <td className="p-3">{item.warehouse?.name}</td>
                <td className={`p-3 text-right font-semibold ${item.quantity <= item.minQuantity ? 'text-red-600' : ''}`}>
                  {item.quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ProductsReport = () => {
  const { data } = useQuery({
    queryKey: ['report-products'],
    queryFn: () => api.get('/reports/products', { params: { limit: 20 } }).then((r) => r.data.data),
  })

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 font-semibold">Sản phẩm bán chạy</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data || []}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="productId" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="_sum.quantity" fill="#6366f1" radius={[4, 4, 0, 0]} name="Số lượng bán" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const CustomersReport = () => {
  const { data } = useQuery({
    queryKey: ['report-customers'],
    queryFn: () => api.get('/reports/customers').then((r) => r.data.data),
  })

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="p-3 text-left font-medium text-muted-foreground">Khách hàng</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Loại</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Tổng đơn</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Tổng chi tiêu</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c: any) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-accent/40">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.type === 'WHOLESALE' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                    {c.type === 'WHOLESALE' ? 'Buôn' : 'Lẻ'}
                  </span>
                </td>
                <td className="p-3 text-right">{c.totalOrders}</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(c.totalSpent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
