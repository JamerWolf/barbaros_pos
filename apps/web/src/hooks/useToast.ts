import { useState, useCallback, useEffect } from 'react'

interface ToastState {
  message: string
  type: 'success' | 'error'
}

export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), durationMs)
    return () => clearTimeout(timer)
  }, [toast, durationMs])

  return { toast, showToast }
}
