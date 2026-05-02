'use client'

import { usePermission } from '@/lib/hooks/usePermission'

interface PermissionGateProps {
  module: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Conditionally render children based on user permission
 *
 * @example
 * <PermissionGate module="products" action="create">
 *   <Button>Thêm sản phẩm</Button>
 * </PermissionGate>
 */
export const PermissionGate = ({ module, action, children, fallback = null }: PermissionGateProps) => {
  const allowed = usePermission(module, action)
  return allowed ? <>{children}</> : <>{fallback}</>
}
