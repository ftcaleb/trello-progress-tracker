import type { CSSProperties } from 'react'

/* Shared line-icon set (stroke = currentColor), used by the navbar and across
   the app. Keep the visual language consistent — 24x24 viewBox, round caps. */

type IconProps = { size?: number; className?: string; style?: CSSProperties }

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export function HomeIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

export function UsersIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M21 20c0-2.5-1.4-4.7-3.5-5.6" />
    </svg>
  )
}

export function CalendarIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function ShieldIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
    </svg>
  )
}

export function CopyIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M6.5 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5v1" />
    </svg>
  )
}

export function ClockIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function FileTextIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}

export function SunIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

export function ManageIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="18" cy="6" r="2" />
      <path d="M18 8v3M16.3 7l-1.7 1M19.7 7l1.7 1" />
    </svg>
  )
}

export function LogOutIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </svg>
  )
}

export function ChevronIcon({
  open,
  size = 14,
  className,
}: IconProps & { open: boolean }) {
  return (
    <svg
      {...base(size)}
      className={className}
      style={{
        color: 'var(--text-3)',
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.2s ease',
      }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function BurgerIcon({ open, size = 20 }: IconProps & { open: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  )
}
