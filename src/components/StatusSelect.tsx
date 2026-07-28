import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskStatus } from '../types'
import { STATUS_LABELS, STATUS_ORDER } from '../types'

// Visual identity per status.
const triggerClass: Record<TaskStatus, string> = {
  approved:
    'bg-gradient-to-r from-sunburst-500 to-maroon-600 text-white border-transparent',
  in_progress: 'bg-surface text-ink-2 border-line-2',
  blocked: 'bg-st-cancelled-bg text-st-cancelled-fg border-st-cancelled',
}

const dotClass: Record<TaskStatus, string> = {
  approved: 'bg-white',
  in_progress: 'bg-ink-3',
  blocked: 'bg-st-cancelled',
}

const MENU_WIDTH = 160

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'approved') return <span aria-hidden="true">✓</span>
  if (status === 'blocked') return <span aria-hidden="true">⚠</span>
  return <span className={`h-2 w-2 rounded-full ${dotClass[status]}`} />
}

export function StatusSelect({
  value,
  onChange,
  isAdmin = false,
}: {
  value: TaskStatus
  onChange: (status: TaskStatus) => void
  isAdmin?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Members cannot change status at all if approved — approved is fully locked.
  const isLocked = !isAdmin && value === 'approved'

  // Members only see in_progress and blocked options.
  const availableStatuses: TaskStatus[] = isAdmin
    ? STATUS_ORDER
    : STATUS_ORDER.filter((s) => s !== 'approved')

  const reposition = () => {
    const b = btnRef.current?.getBoundingClientRect()
    if (!b) return
    const menuHeight = availableStatuses.length * 40 + 8
    let top = b.bottom + 4
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, b.top - menuHeight - 4) // flip above
    }
    const left = Math.max(
      8,
      Math.min(b.left, window.innerWidth - MENU_WIDTH - 8),
    )
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (open) reposition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(t) &&
        btnRef.current &&
        !btnRef.current.contains(t)
      )
        setOpen(false)
    }
    // Close on scroll/resize to avoid a detached, mis-positioned menu.
    const onScroll = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={isLocked}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (!isLocked) setOpen((v) => !v)
        }}
        title={isLocked ? 'Only admins can change an approved task' : undefined}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-sm transition ${triggerClass[value]} ${
          isLocked ? 'cursor-not-allowed opacity-75' : ''
        }`}
      >
        <StatusIcon status={value} />
        {STATUS_LABELS[value]}
        {!isLocked ? <span className="opacity-60">▾</span> : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: MENU_WIDTH,
              }}
              className="z-[70] animate-fade-in overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-e2"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {availableStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    onChange(status)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-2 ${
                    status === value
                      ? 'font-semibold text-ink'
                      : 'text-ink-2'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      status === 'approved'
                        ? 'bg-gradient-to-r from-sunburst-500 to-maroon-600 text-white'
                        : status === 'blocked'
                          ? 'bg-st-cancelled-bg text-st-cancelled-fg'
                          : 'bg-surface-3 text-ink-3'
                    }`}
                  >
                    {status === 'approved' ? '✓' : status === 'blocked' ? '!' : '·'}
                  </span>
                  {STATUS_LABELS[status]}
                  {status === value ? (
                    <span className="ml-auto text-sunburst-500">●</span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
