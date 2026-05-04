'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, Plus, Pencil, Users, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PermissionGate } from '@/components/ui/PermissionGate'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { usePermission } from '@/lib/hooks/usePermission'

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerRow = {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  gender: string | null
  birthday: string | null
  type: 'RETAIL' | 'WHOLESALE'
  totalOrders: number
  totalSpent: number
  createdAt: string
}

const customerSchema = z.object({
  name: z.string().min(1, 'Tên khách hàng là bắt buộc'),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email không hợp lệ'),
  address: z.string().optional(),
  gender: z.string().optional(),
  birthday: z.string().optional(),
  type: z.enum(['RETAIL', 'WHOLESALE']),
})

type CustomerForm = z.infer<typeof customerSchema>

const inputCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const Field = ({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">{label}</label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)

const DEFAULT_FORM: CustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gender: '',
  birthday: '',
  type: 'RETAIL',
}

const CustomerModal = ({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean
  customer: CustomerRow | null
  onClose: () => void
  onSaved: () => void
}) => {
  const isEdit = !!customer
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: DEFAULT_FORM,
  })

  useEffect(() => {
    if (!open) return
    reset(
      customer
        ? {
            name: customer.name,
            phone: customer.phone || '',
            email: customer.email || '',
            address: customer.address || '',
            gender: customer.gender || '',
            birthday: customer.birthday ? customer.birthday.slice(0, 10) : '',
            type: customer.type,
          }
        : DEFAULT_FORM
    )
  }, [open, customer?.id, reset])

  const handleSave = async (data: CustomerForm) => {
    try {
      const payload = {
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        gender: data.gender || undefined,
        birthday: data.birthday || undefined,
        type: data.type,
      }
      if (isEdit) {
        await api.put(`/customers/${customer.id}`, payload)
        toast.success('Đã cập nhật khách hàng')
      } else {
        await api.post('/customers', payload)
        toast.success('Đã thêm khách hàng')
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg || 'Không lưu được')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật thông tin liên hệ và phân loại khách.'
              : 'Nhập thông tin để lưu vào danh sách khách hàng.'}
          </DialogDescription>
        </DialogHeader>

        <form id="customer-form" onSubmit={handleSubmit(handleSave)} className="space-y-4">
          <Field label="Tên *" error={errors.name?.message}>
            <input {...register('name')} placeholder="Họ và tên" className={inputCls} autoComplete="name" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số điện thoại" error={errors.phone?.message}>
              <input {...register('phone')} placeholder="09..." inputMode="tel" className={inputCls} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="email@..." className={inputCls} />
            </Field>
          </div>

          <Field label="Địa chỉ" error={errors.address?.message}>
            <input {...register('address')} placeholder="Số nhà, đường, phường..." className={inputCls} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Giới tính" error={errors.gender?.message}>
              <select {...register('gender')} className={inputCls}>
                <option value="">— Không chọn —</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>
            <Field label="Sinh nhật" error={errors.birthday?.message}>
              <input {...register('birthday')} type="date" className={inputCls} />
            </Field>
          </div>

          <Field label="Loại khách" error={errors.type?.message}>
            <select {...register('type')} className={inputCls}>
              <option value="RETAIL">Bán lẻ</option>
              <option value="WHOLESALE">Bán buôn</option>
            </select>
          </Field>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Lưu thay đổi' : 'Thêm khách hàng'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [modal, setModal] = useState<{ open: boolean; customer: CustomerRow | null }>({
    open: false,
    customer: null,
  })
  const canCreate = usePermission('customers', 'create')
  const canUpdate = usePermission('customers', 'update')

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, type],
    queryFn: () =>
      api.get('/customers', { params: { page, limit: 20, search, type: type || undefined } }).then((r) => r.data),
    keepPreviousData: true,
  })

  const customers: CustomerRow[] = data?.data || []
  const pagination = data?.pagination

  const handleOpenEdit = (c: CustomerRow) => {
    if (!canUpdate) return
    setModal({ open: true, customer: c })
  }

  const handleRowKeyDown = (e: React.KeyboardEvent, c: CustomerRow) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpenEdit(c)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <p className="text-sm text-muted-foreground">
          Theo dõi khách lẻ / buôn, lịch sử chi tiêu và liên hệ nhanh khi tạo đơn.
        </p>
        {pagination && pagination.total > 0 && (
          <p className="text-sm font-medium tabular-nums text-muted-foreground">{pagination.total} khách hàng</p>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tên, SĐT, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Tìm khách hàng"
              className="h-10 w-full min-w-[200px] rounded-lg border border-input bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:w-64"
            />
          </div>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Lọc loại khách"
          >
            <option value="">Tất cả loại</option>
            <option value="RETAIL">Bán lẻ</option>
            <option value="WHOLESALE">Bán buôn</option>
          </select>
        </div>

        <PermissionGate module="customers" action="create">
          <button
            type="button"
            onClick={() => setModal({ open: true, customer: null })}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Thêm khách hàng
          </button>
        </PermissionGate>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="p-3 text-left font-semibold text-muted-foreground">Mã KH</th>
                <th className="p-3 text-left font-semibold text-muted-foreground">Khách hàng</th>
                <th className="hidden p-3 text-left font-semibold text-muted-foreground md:table-cell">Liên hệ</th>
                <th className="p-3 text-center font-semibold text-muted-foreground">Loại</th>
                <th className="p-3 text-right font-semibold text-muted-foreground">Đơn</th>
                <th className="p-3 text-right font-semibold text-muted-foreground">Chi tiêu</th>
                <th className="hidden p-3 text-left font-semibold text-muted-foreground lg:table-cell">Ngày tạo</th>
                <th className="p-3 text-center font-semibold text-muted-foreground w-14">Sửa</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <Users className="h-10 w-10 text-muted-foreground/50" aria-hidden />
                      <p className="text-muted-foreground">Chưa có khách hàng.</p>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => setModal({ open: true, customer: null })}
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Thêm khách đầu tiên
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border/50 transition-colors hover:bg-accent/50 ${
                      canUpdate ? 'cursor-pointer' : ''
                    }`}
                    tabIndex={canUpdate ? 0 : undefined}
                    onClick={() => handleOpenEdit(c)}
                    onKeyDown={(e) => handleRowKeyDown(e, c)}
                    aria-label={canUpdate ? `Mở chỉnh sửa ${c.name}` : undefined}
                  >
                    <td className="p-3 font-mono text-xs">{c.code}</td>
                    <td className="p-3">
                      <span className="font-medium">{c.name}</span>
                      <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                        {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="hidden max-w-[200px] p-3 md:table-cell">
                      <div className="truncate text-muted-foreground">{c.phone || '—'}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.email || ''}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          c.type === 'WHOLESALE' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {c.type === 'WHOLESALE' ? 'Buôn' : 'Lẻ'}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{c.totalOrders}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{formatCurrency(c.totalSpent)}</td>
                    <td className="hidden p-3 text-xs text-muted-foreground lg:table-cell">
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <PermissionGate module="customers" action="update">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          aria-label={`Sửa ${c.name}`}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Trang {page}/{pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <CustomerModal
        open={modal.open}
        customer={modal.customer}
        onClose={() => setModal({ open: false, customer: null })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
      />
    </div>
  )
}
