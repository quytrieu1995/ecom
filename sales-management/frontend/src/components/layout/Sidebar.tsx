'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/lib/hooks/usePermission'
import { useAuthStore } from '@/lib/store/auth.store'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    module: null,
    action: null,
  },
  {
    label: 'Sản phẩm',
    href: '/products',
    icon: Package,
    module: 'products',
    action: 'read',
  },
  {
    label: 'Kho hàng',
    href: '/inventory',
    icon: Warehouse,
    module: 'inventory',
    action: 'read',
  },
  {
    label: 'Đơn hàng',
    href: '/orders',
    icon: ShoppingCart,
    module: 'orders',
    action: 'read',
  },
  {
    label: 'Khách hàng',
    href: '/customers',
    icon: Users,
    module: 'customers',
    action: 'read',
  },
  {
    label: 'Báo cáo',
    href: '/reports',
    icon: BarChart3,
    module: 'reports',
    action: 'read',
  },
]

const SETTINGS_ITEMS = [
  { label: 'Nhanh.vn', href: '/settings/nhanh', icon: Store, module: 'settings', action: 'read' },
  { label: 'Người dùng', href: '/settings/users', icon: Users, module: 'users', action: 'read' },
]

export const Sidebar = () => {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const check = usePermissions()
  const user = useAuthStore((s) => s.user)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold">Thuận Chay</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          if (item.module && !check(item.module, item.action!)) return null
          return (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          )
        })}

        <div className="my-2 border-t border-border" />
        <p
          className={cn(
            'px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground',
            collapsed && 'hidden'
          )}
        >
          Cài đặt
        </p>
        {SETTINGS_ITEMS.map((item) => {
          if (item.module && !check(item.module, item.action!)) return null
          return (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          )
        })}
      </nav>

      {/* User summary */}
      {!collapsed && user && (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 overflow-hidden rounded-md px-2 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.roleDisplayName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  )
}

const NavItem = ({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  collapsed: boolean
}) => (
  <Link
    href={href}
    tabIndex={0}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      collapsed && 'justify-center px-2'
    )}
  >
    <Icon className="h-4 w-4 shrink-0" />
    {!collapsed && <span className="truncate">{label}</span>}
  </Link>
)
