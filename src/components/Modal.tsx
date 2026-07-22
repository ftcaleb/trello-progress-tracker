import { useEffect, type ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
  headerRight,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  maxWidth?: string
  headerRight?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={onClose}
    >
      <div
        className={`relative my-auto w-full ${maxWidth} animate-fade-in overflow-hidden rounded-2xl bg-white shadow-modal`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-6 py-4">
          <div className="min-w-0">
            <div className="text-lg font-bold text-navy-900">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-navy-400">{subtitle}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto fi-scroll p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
