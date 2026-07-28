import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ToastKind = 'error' | 'success' | 'info'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void
  error: (message: string) => void
  success: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, kind }])
      window.setTimeout(() => remove(id), 4800)
    },
    [remove],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      error: (m) => push(m, 'error'),
      success: (m) => push(m, 'success'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const styles =
    toast.kind === 'error'
      ? { bar: 'bg-sunburst-500', border: 'border-line' }
      : toast.kind === 'success'
        ? { bar: 'bg-maroon-600', border: 'border-line' }
        : { bar: 'bg-ink-3', border: 'border-line' }

  return (
    <div
      className={`pointer-events-auto flex items-stretch gap-0 overflow-hidden rounded-xl border ${styles.border} bg-surface shadow-e3 animate-fade-in`}
      role="alert"
    >
      <span className={`w-1.5 shrink-0 ${styles.bar}`} />
      <div className="flex flex-1 items-start gap-3 px-4 py-3">
        <span className="flex-1 text-sm leading-snug text-ink">
          {toast.message}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-ink-3 transition hover:text-ink"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
