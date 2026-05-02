'use client'

import { useAuthStore } from '@/lib/store/auth.store'

/**
 * Check if the current user has a specific permission
 *
 * @example
 * const canCreate = usePermission('products', 'create')
 */
export const usePermission = (module: string, action: string): boolean => {
  const user = useAuthStore((s) => s.user)
  if (!user) return false
  if (user.role === 'ADMIN') return true
  return user.permissions.some((p) => p.module === module && p.action === action)
}

/**
 * Returns a checker function for multiple permission checks
 */
export const usePermissions = () => {
  const user = useAuthStore((s) => s.user)

  return (module: string, action: string): boolean => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.permissions.some((p) => p.module === module && p.action === action)
  }
}
