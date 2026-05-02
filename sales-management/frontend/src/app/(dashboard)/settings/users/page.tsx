'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, UserCheck, UserX, Key } from 'lucide-react'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { usePermission } from '@/lib/hooks/usePermission'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Hoạt động', color: 'bg-green-50 text-green-700' },
  INACTIVE: { label: 'Ngừng hoạt động', color: 'bg-gray-100 text-gray-600' },
  SUSPENDED: { label: 'Bị khóa', color: 'bg-red-50 text-red-700' },
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-700',
  MANAGER: 'bg-blue-50 text-blue-700',
  STAFF: 'bg-green-50 text-green-700',
  ACCOUNTANT: 'bg-amber-50 text-amber-700',
  VIEWER: 'bg-gray-100 text-gray-700',
}

const MODULES = ['products', 'inventory', 'orders', 'customers', 'reports', 'users', 'settings']
const MODULE_LABELS: Record<string, string> = {
  products: 'Sản phẩm',
  inventory: 'Kho hàng',
  orders: 'Đơn hàng',
  customers: 'Khách hàng',
  reports: 'Báo cáo',
  users: 'Người dùng',
  settings: 'Cài đặt',
}
const ACTIONS = ['read', 'create', 'update', 'delete', 'export', 'sync']
const ACTION_LABELS: Record<string, string> = {
  read: 'Xem', create: 'Tạo', update: 'Sửa',
  delete: 'Xóa', export: 'Xuất', sync: 'Sync',
}

const TABS = ['Danh sách Users', 'Roles & Quyền', 'Lịch sử hoạt động'] as const

export default function UsersSettingsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Danh sách Users')

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

      {tab === 'Danh sách Users' && <UsersTab />}
      {tab === 'Roles & Quyền' && <RolesTab />}
      {tab === 'Lịch sử hoạt động' && <ActivityTab />}
    </div>
  )
}

const UsersTab = () => {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users', { params: { limit: 50 } }).then((r) => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = data?.data || []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Thêm người dùng
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Người dùng</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Role</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Trạng thái</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Đăng nhập cuối</th>
                <th className="p-3 text-center font-medium text-muted-foreground">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="p-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Không có người dùng</td></tr>
              ) : (
                users.map((u: any) => {
                  const statusInfo = STATUS_MAP[u.status] || { label: u.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-accent/40">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role?.name] || 'bg-gray-100 text-gray-700'}`}>
                          {u.role?.displayName}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Chưa đăng nhập'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button title="Sửa" className="rounded p-1.5 hover:bg-accent"><Edit className="h-3.5 w-3.5" /></button>
                          <button title="Reset mật khẩu" className="rounded p-1.5 hover:bg-accent"><Key className="h-3.5 w-3.5" /></button>
                          <button
                            title={u.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                            onClick={() => statusMutation.mutate({
                              id: u.id,
                              status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                            })}
                            className="rounded p-1.5 hover:bg-accent"
                          >
                            {u.status === 'ACTIVE' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </button>
                          <button title="Xóa" className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const RolesTab = () => {
  const [selectedRole, setSelectedRole] = useState<any>(null)

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data.data),
  })

  const hasPermission = (permissions: any[], module: string, action: string) =>
    permissions?.some((p) => p.module === module && p.action === action)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Role list */}
      <div className="space-y-2">
        {roles?.map((role: any) => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role)}
            className={`w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent ${
              selectedRole?.id === role.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role.name] || 'bg-gray-100 text-gray-700'}`}>
                {role.name}
              </span>
              <span className="text-xs text-muted-foreground">{role._count?.users} users</span>
            </div>
            <p className="mt-1.5 text-sm font-medium">{role.displayName}</p>
            {role.description && <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>}
          </button>
        ))}
      </div>

      {/* Permission matrix */}
      {selectedRole ? (
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Quyền — {selectedRole.displayName}</h3>
          {selectedRole.name === 'ADMIN' ? (
            <div className="rounded-lg bg-purple-50 p-4 text-sm text-purple-700">
              ADMIN có toàn quyền hệ thống, không giới hạn.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="pb-2 text-center font-medium text-muted-foreground">{ACTION_LABELS[a]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod) => (
                    <tr key={mod} className="border-b border-border/50">
                      <td className="py-2.5 font-medium">{MODULE_LABELS[mod]}</td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="py-2.5 text-center">
                          {hasPermission(selectedRole.permissions, mod, action) ? (
                            <span className="text-green-600">✅</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="lg:col-span-2 flex items-center justify-center rounded-xl border border-dashed border-border p-12 text-muted-foreground">
          Chọn một role để xem ma trận quyền
        </div>
      )}
    </div>
  )
}

const ActivityTab = () => {
  const { data } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () =>
      api.get('/users/activity', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []),
  })

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="p-3 text-left font-medium text-muted-foreground">Người dùng</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Hành động</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Module</th>
              <th className="p-3 text-left font-medium text-muted-foreground">IP</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((log: any) => (
              <tr key={log.id} className="border-b border-border/50 hover:bg-accent/40">
                <td className="p-3">{log.user?.name || log.userId}</td>
                <td className="p-3 font-mono text-xs">{log.action}</td>
                <td className="p-3 capitalize">{log.module}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{log.ipAddress || '—'}</td>
                <td className="p-3 text-muted-foreground">{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
