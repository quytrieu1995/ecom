'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Cần ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Cần ít nhất 1 chữ số')
      .regex(/[^A-Za-z0-9]/, 'Cần ít nhất 1 ký tự đặc biệt'),
    confirmPassword: z.string().min(1, 'Xác nhận mật khẩu'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function ChangePasswordPage() {
  const router = useRouter()
  const { updateUser } = useAuthStore()
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const handleChange = async (data: FormData) => {
    setServerError(null)
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      updateUser({ mustChangePassword: false })
      router.replace('/')
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Đổi mật khẩu thất bại')
    }
  }

  const toggleField = (field: keyof typeof show) =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }))

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Đổi mật khẩu</h1>
            <p className="text-sm text-muted-foreground">
              Vui lòng đổi mật khẩu trước khi tiếp tục
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleChange)} className="space-y-4" noValidate>
          {/* Current password */}
          <PasswordField
            id="currentPassword"
            label="Mật khẩu hiện tại"
            show={show.current}
            onToggle={() => toggleField('current')}
            register={register('currentPassword')}
            error={errors.currentPassword?.message}
          />

          {/* New password */}
          <PasswordField
            id="newPassword"
            label="Mật khẩu mới"
            show={show.new}
            onToggle={() => toggleField('new')}
            register={register('newPassword')}
            error={errors.newPassword?.message}
          />

          {/* Confirm password */}
          <PasswordField
            id="confirmPassword"
            label="Xác nhận mật khẩu mới"
            show={show.confirm}
            onToggle={() => toggleField('confirm')}
            register={register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />

          {serverError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Đổi mật khẩu
          </button>
        </form>
      </div>
    </div>
  )
}

const PasswordField = ({
  id,
  label,
  show,
  onToggle,
  register,
  error,
}: {
  id: string
  label: string
  show: boolean
  onToggle: () => void
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error?: string
}) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        {...register}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)
