'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/lib/store/auth.store'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Sản phẩm',
  '/inventory': 'Kho hàng',
  '/orders': 'Đơn hàng',
  '/customers': 'Khách hàng',
  '/reports': 'Báo cáo',
  '/settings/nhanhvn': 'Cài đặt Nhanh.vn',
  '/settings/users': 'Quản lý người dùng',
}

export const Header = () => {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, clearAuth } = useAuthStore()

  const { data: healthData } = useQuery({
    queryKey: ['nhanhvn-status'],
    queryFn: () => api.get('/sync/test-connection').then((r) => r.data.data),
    refetchInterval: 60_000,
    retry: false,
  })

  const pageTitle = ROUTE_LABELS[pathname] || pathname.split('/').pop() || 'Dashboard'

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {
        refreshToken: localStorage.getItem('refresh_token'),
      })
    } catch {}
    clearAuth()
    router.push('/login')
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      {/* Breadcrumb */}
      <div>
        <h1 className="text-base font-semibold">{pageTitle}</h1>
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Nhanh.vn connection status */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            healthData?.connected
              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
          )}
          title="Trạng thái kết nối nhanh.vn"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              healthData?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )}
          />
          nhanh.vn
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Chuyển đổi giao diện"
          tabIndex={0}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button
          aria-label="Thông báo"
          tabIndex={0}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User menu */}
        <div className="group relative">
          <button
            tabIndex={0}
            aria-label="Menu người dùng"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <span className="hidden font-medium md:inline">{user?.name}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-md border border-border bg-card shadow-md group-focus-within:block group-hover:block">
            <div className="border-b border-border p-2">
              <p className="truncate text-xs font-medium">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground">{user?.roleDisplayName}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => router.push('/profile')}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <User className="h-4 w-4" />
                Hồ sơ cá nhân
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
