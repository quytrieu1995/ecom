'use client'

import { useEffect } from 'react'

const clearAllCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) return
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
}

/**
 * Gỡ Service Worker & Cache Storage cũ (sw.js legacy) để không chặn navigation/fetch.
 */
export const ServiceWorkerUnregister = () => {
  useEffect(() => {
    const run = async () => {
      try {
        await clearAllCaches()
        if (!('serviceWorker' in navigator)) return
        const registrations = await navigator.serviceWorker.getRegistrations()
        if (registrations.length === 0) return
        await Promise.all(registrations.map((r) => r.unregister()))
      } catch {
        // bỏ qua — môi trường không hỗ trợ hoặc đã sạch
      }
    }

    void run()
  }, [])

  return null
}
