'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// Simple global toast store
const listeners: Set<(toast: Toast) => void> = new Set()

export const toast = {
  success: (message: string) => emit({ id: crypto.randomUUID(), message, type: 'success' }),
  error: (message: string) => emit({ id: crypto.randomUUID(), message, type: 'error' }),
  info: (message: string) => emit({ id: crypto.randomUUID(), message, type: 'info' }),
}

const emit = (toast: Toast) => listeners.forEach((fn) => fn(toast))

export const Toaster = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000)
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg',
            t.type === 'success' && 'border-green-200 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
            t.type === 'error' && 'border-red-200 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
            t.type === 'info' && 'border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
          )}
        >
          <span>{t.message}</span>
          <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
