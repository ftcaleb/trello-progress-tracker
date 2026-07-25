import { useEffect, useRef, useState } from 'react'
import type { TaskStatus } from '../types'
import { STATUS_LABELS, STATUS_ORDER } from '../types'

// Visual identity per status.
const triggerClass: Record<TaskStatus, string> = {
  approved:
    'bg-gradient-to-r from-sunburst-500 to-maroon-600 text-white border-transparent',
  in_progress: 'bg-white text-navy-700 border-navy-200',
  blocked: 'bg-red-50 text-red-700 border-red-300',
}

const dotClass: Record<TaskStatus, string> = {
  approved: 'bg-white',
  in_progress: 'bg-navy-300',
  blocked: 'bg-red-500',
}

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
  const ref = useRef<HTMLDivElement>(null)

  // Members cannot change status at all if approved — approved is fully locked.
  const isLocked = !isAdmin && value === 'approved'

  // Members only see in_progress and blocked options.
  const availableStatuses: TaskStatus[] = isAdmin
    ? STATUS_ORDER
    : STATUS_ORDER.filter((s) => s !== 'approved')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={isLocked}
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

      {open ? (
        <div
          className="absolute left-0 top-8 z-30 w-40 animate-fade-in overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {availableStatuses.map((status) => (
            <button
              key={status}
              onClick={() => {
                onChange(status)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-navy-50 ${
                status === value ? 'font-semibold text-navy-900' : 'text-navy-600'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  status === 'approved'
                    ? 'bg-gradient-to-r from-sunburst-500 to-maroon-600 text-white'
                    : status === 'blocked'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-navy-100 text-navy-500'
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
        </div>
      ) : null}
    </div>
  )
}
