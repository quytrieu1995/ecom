'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Plug,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  ShoppingBag,
  Package,
  BarChart3,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type NhanhAccount = {
  id: number
  name: string
  businessId: string
  appId: string
  isActive: boolean
  lastSyncAt: string | null
  syncInterval: number
  note: string | null
  createdAt: string
}

type ConnectionStatus = {
  id: number
  status: 'idle' | 'testing' | 'success' | 'failed'
  latencyMs?: number
  error?: string
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(1, 'Tên tài khoản không được trống'),
  businessId: z.string().min(1, 'Business ID không được trống'),
  appId: z.string().min(1, 'App ID không được trống'),
  accessToken: z.string().min(1, 'Access Token không được trống'),
  webhookSecret: z.string().optional(),
  syncInterval: z.coerce.number().min(5).max(1440).default(30),
  note: z.string().optional(),
  isActive: z.boolean().default(true),
})

type AccountForm = z.infer<typeof accountSchema>

// ─── Sub-components ───────────────────────────────────────────────────────────

const SyncButton = ({
  accountId,
  accountName,
  type,
  icon: Icon,
  label,
}: {
  accountId: number
  accountName: string
  type: 'products' | 'orders' | 'inventory'
  icon: React.ElementType
  label: string
}) => {
  const [loading, setLoading] = useState(false)

  const handleSync = async () => {
    setLoading(true)
    try {
      await api.post(`/nhanh/accounts/${accountId}/sync/${type}`)
      toast.success(`Đã kích hoạt sync ${label} cho "${accountName}"`)
    } catch {
      toast.error(`Không thể sync ${label}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenuItem onClick={handleSync} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      Sync {label}
    </DropdownMenuItem>
  )
}

// ─── Account Modal ────────────────────────────────────────────────────────────

const AccountModal = ({
  open,
  onClose,
  editAccount,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editAccount: NhanhAccount | null
  onSaved: () => void
}) => {
  const [showToken, setShowToken] = useState(false)
  const isEdit = !!editAccount

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(
      isEdit
        ? accountSchema.extend({ accessToken: z.string().optional().default('') })
        : accountSchema
    ),
    defaultValues: { syncInterval: 30, isActive: true },
  })

  const isActive = watch('isActive')

  useEffect(() => {
    if (editAccount) {
      reset({
        name: editAccount.name,
        businessId: editAccount.businessId,
        appId: editAccount.appId,
        accessToken: '',
        syncInterval: editAccount.syncInterval,
        note: editAccount.note || '',
        isActive: editAccount.isActive,
      })
    } else {
      reset({ syncInterval: 30, isActive: true })
    }
    setShowToken(false)
  }, [editAccount, reset])

  const onSubmit = async (data: AccountForm) => {
    try {
      if (isEdit) {
        const payload = { ...data }
        if (!payload.accessToken) delete (payload as Record<string, unknown>).accessToken
        await api.put(`/nhanh/accounts/${editAccount!.id}`, payload)
        toast.success('Đã cập nhật tài khoản')
      } else {
        await api.post('/nhanh/accounts', data)
        toast.success('Đã thêm tài khoản Nhanh.vn')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Có lỗi xảy ra')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản Nhanh.vn'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label>Tên tài khoản *</Label>
            <Input {...register('name')} placeholder="VD: Shop Hà Nội" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Business ID + App ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Business ID *</Label>
              <Input {...register('businessId')} placeholder="123456" />
              {errors.businessId && <p className="text-xs text-red-500">{errors.businessId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>App ID *</Label>
              <Input {...register('appId')} placeholder="App ID từ Nhanh.vn" />
              {errors.appId && <p className="text-xs text-red-500">{errors.appId.message}</p>}
            </div>
          </div>

          {/* Access Token */}
          <div className="space-y-1">
            <Label>Access Token {isEdit ? '(để trống để giữ nguyên)' : '*'}</Label>
            <div className="relative">
              <Input
                {...register('accessToken')}
                type={showToken ? 'text' : 'password'}
                placeholder={isEdit ? '••••••••••••••••' : 'Access Token từ Nhanh.vn'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.accessToken && <p className="text-xs text-red-500">{errors.accessToken.message}</p>}
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1">
            <Label>Webhook Secret (tuỳ chọn)</Label>
            <Input {...register('webhookSecret')} type="password" placeholder="Dùng để xác thực webhook" />
          </div>

          {/* Sync interval + Active */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tự động sync (phút)</Label>
              <Input {...register('syncInterval')} type="number" min={5} max={1440} />
              {errors.syncInterval && <p className="text-xs text-red-500">{errors.syncInterval.message}</p>}
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={isActive}
                onCheckedChange={(v) => setValue('isActive', v)}
              />
              <Label className="cursor-pointer">{isActive ? 'Đang bật' : 'Đã tắt'}</Label>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label>Ghi chú</Label>
            <Textarea {...register('note')} rows={2} placeholder="Ghi chú tuỳ chọn..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Lưu thay đổi' : 'Thêm tài khoản'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NhanhSettingsPage() {
  const [accounts, setAccounts] = useState<NhanhAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<NhanhAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NhanhAccount | null>(null)
  const [connStatus, setConnStatus] = useState<Record<number, ConnectionStatus>>({})

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/nhanh/accounts')
      setAccounts(res.data.data || [])
    } catch {
      toast.error('Không thể tải danh sách tài khoản')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleTestConnection = async (account: NhanhAccount) => {
    setConnStatus((prev) => ({ ...prev, [account.id]: { id: account.id, status: 'testing' } }))
    try {
      const res = await api.post(`/nhanh/accounts/${account.id}/test`)
      const data = res.data.data
      setConnStatus((prev) => ({
        ...prev,
        [account.id]: {
          id: account.id,
          status: data.connected ? 'success' : 'failed',
          latencyMs: data.latencyMs,
          error: data.error,
        },
      }))
      if (data.connected) {
        toast.success(`Kết nối thành công (${data.latencyMs}ms)`)
      } else {
        toast.error(`Kết nối thất bại: ${data.error}`)
      }
    } catch {
      setConnStatus((prev) => ({ ...prev, [account.id]: { id: account.id, status: 'failed' } }))
      toast.error('Không thể kiểm tra kết nối')
    }
  }

  const handleToggleActive = async (account: NhanhAccount) => {
    try {
      await api.put(`/nhanh/accounts/${account.id}`, { isActive: !account.isActive })
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, isActive: !a.isActive } : a))
      )
      toast.success(account.isActive ? 'Đã tắt tài khoản' : 'Đã bật tài khoản')
    } catch {
      toast.error('Không thể thay đổi trạng thái')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/nhanh/accounts/${deleteTarget.id}`)
      toast.success('Đã xóa tài khoản')
      setDeleteTarget(null)
      fetchAccounts()
    } catch {
      toast.error('Không thể xóa tài khoản')
    }
  }

  const openEdit = (account: NhanhAccount) => {
    setEditAccount(account)
    setModalOpen(true)
  }

  const openCreate = () => {
    setEditAccount(null)
    setModalOpen(true)
  }

  const statusIcon = (id: number) => {
    const s = connStatus[id]
    if (!s || s.status === 'idle') return null
    if (s.status === 'testing') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    if (s.status === 'success')
      return <CheckCircle className="h-4 w-4 text-green-500" title={`${s.latencyMs}ms`} />
    return <XCircle className="h-4 w-4 text-red-500" title={s.error} />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tài khoản Nhanh.vn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý kết nối với nhiều tài khoản Nhanh.vn, đồng bộ dữ liệu độc lập cho từng tài khoản
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm tài khoản
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng tài khoản', value: accounts.length, color: 'text-blue-600' },
          {
            label: 'Đang hoạt động',
            value: accounts.filter((a) => a.isActive).length,
            color: 'text-green-600',
          },
          {
            label: 'Đã tắt',
            value: accounts.filter((a) => !a.isActive).length,
            color: 'text-gray-500',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên tài khoản</TableHead>
              <TableHead>Business ID</TableHead>
              <TableHead>App ID</TableHead>
              <TableHead>Sync interval</TableHead>
              <TableHead>Sync cuối</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Kết nối</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  <Plug className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Chưa có tài khoản nào. Thêm tài khoản Nhanh.vn đầu tiên.</p>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{account.name}</p>
                      {account.note && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {account.note}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{account.businessId}</TableCell>
                  <TableCell className="font-mono text-sm">{account.appId}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {account.syncInterval} phút
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {account.lastSyncAt
                      ? format(new Date(account.lastSyncAt), 'HH:mm dd/MM', { locale: vi })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={account.isActive}
                        onCheckedChange={() => handleToggleActive(account)}
                      />
                      <Badge variant={account.isActive ? 'default' : 'secondary'}>
                        {account.isActive ? 'Bật' : 'Tắt'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(account)}
                        disabled={connStatus[account.id]?.status === 'testing'}
                        className="h-7 px-2 text-xs"
                      >
                        {connStatus[account.id]?.status === 'testing' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plug className="h-3 w-3" />
                        )}
                        <span className="ml-1">Test</span>
                      </Button>
                      {statusIcon(account.id)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(account)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <SyncButton
                          accountId={account.id}
                          accountName={account.name}
                          type="products"
                          icon={Package}
                          label="sản phẩm"
                        />
                        <SyncButton
                          accountId={account.id}
                          accountName={account.name}
                          type="orders"
                          icon={ShoppingBag}
                          label="đơn hàng"
                        />
                        <SyncButton
                          accountId={account.id}
                          accountName={account.name}
                          type="inventory"
                          icon={BarChart3}
                          label="kho hàng"
                        />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteTarget(account)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa tài khoản
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Hướng dẫn */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
          Hướng dẫn lấy thông tin kết nối
        </h3>
        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>
            Đăng nhập vào{' '}
            <a
              href="https://nhanh.vn"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              nhanh.vn
            </a>{' '}
            → Cài đặt → Tích hợp API
          </li>
          <li>
            Tìm <strong>Business ID</strong> (ID doanh nghiệp) trong phần thông tin tài khoản
          </li>
          <li>
            Tạo ứng dụng để lấy <strong>App ID</strong> và <strong>Access Token</strong>
          </li>
          <li>
            (Tuỳ chọn) Thiết lập Webhook URL:{' '}
            <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">
              {typeof window !== 'undefined' ? window.location.origin.replace('3000', '4000') : ''}/webhooks/nhanh
            </code>
          </li>
        </ol>
      </div>

      {/* Modals */}
      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editAccount={editAccount}
        onSaved={fetchAccounts}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa tài khoản</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa tài khoản{' '}
              <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>?
              <br />
              Lịch sử đồng bộ của tài khoản này sẽ bị xóa. Dữ liệu sản phẩm và đơn hàng không bị ảnh hưởng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
