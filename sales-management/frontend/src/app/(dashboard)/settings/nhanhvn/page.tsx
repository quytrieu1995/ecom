'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle2, XCircle, RefreshCw, Loader2, Clock } from 'lucide-react'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

export default function NhanhVNSettingsPage() {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; error?: string } | null>(null)

  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => api.get('/sync/logs', { params: { limit: 20 } }).then((r) => r.data.data),
    refetchInterval: 10_000,
  })

  const syncProductsMutation = useMutation({
    mutationFn: () => api.post('/sync/products'),
    onSuccess: () => refetchLogs(),
  })

  const syncOrdersMutation = useMutation({
    mutationFn: () => api.post('/sync/orders'),
    onSuccess: () => refetchLogs(),
  })

  const syncInventoryMutation = useMutation({
    mutationFn: () => api.post('/sync/inventory'),
    onSuccess: () => refetchLogs(),
  })

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.get('/sync/test-connection')
      setTestResult(res.data.data)
    } catch (err: any) {
      setTestResult({ connected: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Connection status */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Kết nối Nhanh.vn</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">API URL</span>
            <span className="font-mono">https://api.nhanh.vn</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">App ID</span>
            <span className="font-mono">{process.env.NEXT_PUBLIC_APP_URL ? '***' : 'Chưa cấu hình'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Webhook URL</span>
            <span className="font-mono text-xs">{`${process.env.NEXT_PUBLIC_APP_URL || 'https://ql.thuanchay.vn'}/webhooks/nhanhvn`}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Test kết nối
          </button>

          {testResult && (
            <div className={`flex items-center gap-2 text-sm font-medium ${testResult.connected ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.connected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.connected ? 'Kết nối thành công' : `Lỗi: ${testResult.error}`}
            </div>
          )}
        </div>
      </div>

      {/* Manual sync */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold">Đồng bộ thủ công</h3>
        <div className="flex flex-wrap gap-3">
          <SyncButton
            label="Sync sản phẩm"
            mutation={syncProductsMutation}
            description="Kéo toàn bộ sản phẩm từ nhanh.vn"
          />
          <SyncButton
            label="Sync đơn hàng"
            mutation={syncOrdersMutation}
            description="Kéo đơn hàng mới nhất từ nhanh.vn"
          />
          <SyncButton
            label="Sync kho hàng"
            mutation={syncInventoryMutation}
            description="Cập nhật tồn kho từ nhanh.vn"
          />
        </div>
      </div>

      {/* Sync logs */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Lịch sử đồng bộ</h3>
          <button
            onClick={() => refetchLogs()}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" />
            Làm mới
          </button>
        </div>

        <div className="space-y-2">
          {logs?.map((log: any) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium capitalize">{log.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  log.status === 'SUCCESS' ? 'bg-green-50 text-green-700'
                  : log.status === 'FAILED' ? 'bg-red-50 text-red-700'
                  : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {log.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</div>
            </div>
          ))}

          {!logs?.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có lịch sử đồng bộ</p>
          )}
        </div>
      </div>
    </div>
  )
}

const SyncButton = ({
  label,
  mutation,
  description,
}: {
  label: string
  mutation: any
  description: string
}) => (
  <div className="rounded-lg border border-border p-4 w-52">
    <p className="text-sm font-medium">{label}</p>
    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {mutation.isPending ? 'Đang sync...' : 'Chạy ngay'}
    </button>
  </div>
)
