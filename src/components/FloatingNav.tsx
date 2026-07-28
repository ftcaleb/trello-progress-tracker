import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useInterns } from '../hooks/useInterns'
import { useTheme } from '../hooks/useTheme'

// Served from public/ — reference by root URL, not a bundler import.
const monogram = '/Icon-40.png'

/* ============================================================================
   Floating glass pill navigation.

   Realized for this app's internal-scroll model: the nav reserves its own
   band (it never overlays page content), and reads scroll from the inner
   page container via a capture-phase listener so the shrink mechanic still
   fires. The active "lamp" glides between items with a framer-motion
   shared-layout spring. Colors read design tokens; the frosted glass has a
   light and a dark variant.
   ========================================================================== */

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  match: (pathname: string) => boolean
}

export function FloatingNav({ onOpenInterns }: { onOpenInterns: () => void }) {
  const { session, profile, signOut, isAdmin } = useAuth()
  const { interns } = useInterns()
  const { theme, toggle } = useTheme()
  const location = useLocation()

  const [scrolled, setScrolled] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 1080,
  )
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const accountRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)

  // Shrink mechanic — capture scroll from any inner scroll container.
  useEffect(() => {
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | null
      const top = t?.scrollTop ?? 0
      setScrolled(top > 12)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  // Responsive breakpoint (matches the spec's 1080px).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 1080px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  // Close menus on route change.
  useEffect(() => {
    setAccountOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  // Click-outside + Escape for the account panel.
  useEffect(() => {
    if (!accountOpen) return
    const onDown = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAccountOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const displayName =
    profile?.full_name?.trim() ||
    (profile?.moodle_username ? `@${profile.moodle_username}` : null) ||
    session?.user?.email ||
    'Signed in'
  const subLabel = profile?.moodle_username
    ? `@${profile.moodle_username}`
    : session?.user?.email ?? ''
  const avatarLetter = (
    profile?.full_name?.trim()?.[0] ??
    profile?.moodle_username?.[0] ??
    session?.user?.email?.[0] ??
    '?'
  ).toUpperCase()

  const items: NavItem[] = [
    { to: '/', label: 'Home', icon: <HomeIcon />, match: (p) => p === '/' },
    {
      to: '/teams',
      label: 'Teams',
      icon: <UsersIcon />,
      match: (p) => p.startsWith('/teams'),
    },
    {
      to: '/attendance',
      label: 'Attendance',
      icon: <CalendarIcon />,
      match: (p) => p.startsWith('/attendance'),
    },
    ...(isAdmin
      ? [
          {
            to: '/admin',
            label: 'Admin',
            icon: <ShieldIcon />,
            match: (p: string) => p.startsWith('/admin'),
          },
        ]
      : []),
  ]

  const glass = glassStyle(theme, scrolled)
  const glowRGB = theme === 'dark' ? '201,111,162' : '94,7,67'

  return (
    <div className="relative z-40 flex shrink-0 justify-center px-4 sm:px-5">
      <div
        className="relative w-full"
        style={{
          maxWidth: scrolled ? 800 : 1100,
          paddingTop: scrolled ? 10 : 18,
          paddingBottom: 8,
          transition: `max-width 0.4s ${EASE}, padding-top 0.35s ${EASE}`,
        }}
      >
        {/* ---------------- The pill ---------------- */}
        <div
          className="flex items-center justify-between gap-2"
          style={{
            borderRadius: 9999,
            padding: scrolled ? '8px 18px' : '10px 22px',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            transition: `padding 0.35s ${EASE}, box-shadow 0.35s ease, background 0.3s ease`,
            ...glass,
          }}
        >
          {/* Brand — navy tile + collapsing wordmark */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Home"
          >
            <span
              className="grid place-items-center overflow-hidden"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--rail)',
                boxShadow: '0 2px 8px rgba(10,23,51,0.28)',
              }}
            >
              <img
                src={monogram}
                alt=""
                aria-hidden="true"
                className="h-5 w-5 object-contain"
              />
            </span>
            <span
              className="overflow-hidden whitespace-nowrap text-[15px] font-extrabold tracking-tight"
              style={{
                color: 'var(--text-1)',
                maxWidth: scrolled || isMobile ? 0 : 140,
                opacity: scrolled || isMobile ? 0 : 1,
                transition: `max-width 0.35s ${EASE}, opacity 0.25s ease`,
              }}
            >
              FI&nbsp;Tracker
            </span>
          </Link>

          {/* Center nav items (desktop) */}
          {!isMobile && (
            <nav className="flex items-center gap-1">
              {items.map((item) => {
                const active = item.match(location.pathname)
                return (
                  <div key={item.to} className="relative">
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className="relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold"
                      style={{
                        color: 'var(--text-1)',
                        padding: scrolled ? '7px 12px' : '8px 14px',
                        background: active ? 'var(--accent-wash)' : 'transparent',
                        transition: `background 0.2s ease, padding 0.35s ${EASE}`,
                      }}
                    >
                      <span
                        style={{ opacity: active ? 1 : 0.75 }}
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      {item.label}
                      {active && (
                        <span
                          className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                          style={{ background: 'var(--text-1)', opacity: 0.45 }}
                        />
                      )}
                    </NavLink>

                    {/* Active lamp — shared-layout spring */}
                    {active && (
                      <motion.span
                        layoutId="fi-nav-lamp"
                        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                        className="pointer-events-none absolute z-10"
                        style={{
                          top: -14,
                          left: '50%',
                          marginLeft: -16,
                          width: 32,
                          height: 3,
                          borderRadius: '0 0 3px 3px',
                          background: 'var(--text-1)',
                        }}
                      >
                        <GlowLayer w={48} h={24} top={-8} blur={10} rgb={glowRGB} a={0.25} />
                        <GlowLayer w={32} h={20} top={-4} blur={8} rgb={glowRGB} a={0.2} />
                        <GlowLayer w={16} h={14} top={-2} blur={5} rgb={glowRGB} a={0.18} />
                      </motion.span>
                    )}
                  </div>
                )
              })}
            </nav>
          )}

          {/* Right cluster */}
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle theme={theme} onToggle={toggle} />

            {!isMobile ? (
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label="Account menu"
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition"
                  style={{
                    background: accountOpen ? 'var(--accent-wash)' : 'transparent',
                  }}
                >
                  <Avatar letter={avatarLetter} />
                  <ChevronIcon open={accountOpen} />
                </button>

                <AnimatePresence>
                  {accountOpen && (
                    <AccountPanel
                      theme={theme}
                      displayName={displayName}
                      subLabel={subLabel}
                      avatarLetter={avatarLetter}
                      isAdmin={isAdmin}
                      internCount={interns.length}
                      onOpenInterns={() => {
                        setAccountOpen(false)
                        onOpenInterns()
                      }}
                      onSignOut={() => void signOut()}
                    />
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                className="grid h-[38px] w-[38px] place-items-center rounded-full transition"
                style={{
                  background: mobileOpen ? 'var(--rail)' : 'var(--accent-wash)',
                  color: mobileOpen ? 'var(--rail-ink)' : 'var(--text-1)',
                }}
              >
                <BurgerIcon open={mobileOpen} />
              </button>
            )}
          </div>
        </div>

        {/* ---------------- Mobile sheet ---------------- */}
        <AnimatePresence>
          {isMobile && mobileOpen && (
            <motion.div
              ref={mobileRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="absolute left-1/2 top-full z-50 w-full -translate-x-1/2 p-2"
              style={{ marginTop: 8 }}
            >
              <div style={panelStyle(theme)} className="overflow-hidden p-2">
                <div className="mb-1 flex items-center gap-3 px-3 py-2.5">
                  <Avatar letter={avatarLetter} />
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-bold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {displayName}
                    </div>
                    {subLabel && (
                      <div
                        className="truncate text-xs"
                        style={{ color: 'var(--text-3)' }}
                      >
                        {subLabel}
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-px" style={{ background: 'var(--line)' }} />
                <div className="py-1">
                  {items.map((item) => {
                    const active = item.match(location.pathname)
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                        style={{
                          color: 'var(--text-1)',
                          background: active ? 'var(--accent-wash)' : 'transparent',
                        }}
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </NavLink>
                    )
                  })}
                </div>
                {isAdmin && (
                  <>
                    <div className="h-px" style={{ background: 'var(--line)' }} />
                    <button
                      onClick={() => {
                        setMobileOpen(false)
                        onOpenInterns()
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      <ManageIcon />
                      Manage interns
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{
                          background: 'var(--surface-3)',
                          color: 'var(--text-2)',
                        }}
                      >
                        {interns.length}
                      </span>
                    </button>
                  </>
                )}
                <div className="h-px" style={{ background: 'var(--line)' }} />
                <button
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                  style={{ color: 'var(--st-cancelled-fg)' }}
                >
                  <LogOutIcon />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Account mega-panel                                                         */
/* -------------------------------------------------------------------------- */

function AccountPanel({
  theme,
  displayName,
  subLabel,
  avatarLetter,
  isAdmin,
  internCount,
  onOpenInterns,
  onSignOut,
}: {
  theme: 'light' | 'dark'
  displayName: string
  subLabel: string
  avatarLetter: string
  isAdmin: boolean
  internCount: number
  onOpenInterns: () => void
  onSignOut: () => void
}) {
  return (
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="absolute right-0 z-50 w-72 origin-top-right overflow-hidden"
      style={{ top: 'calc(100% + 12px)', ...panelStyle(theme) }}
    >
      <div className="flex items-center gap-3 p-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold"
          style={{
            background:
              'linear-gradient(135deg, var(--brand-orange), var(--accent))',
            color: '#fff',
          }}
        >
          {avatarLetter}
        </span>
        <div className="min-w-0">
          <div
            className="truncate text-sm font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            {displayName}
          </div>
          {subLabel && (
            <div className="truncate text-xs" style={{ color: 'var(--text-3)' }}>
              {subLabel}
            </div>
          )}
        </div>
      </div>

      <div className="h-px" style={{ background: 'var(--line)' }} />

      {isAdmin && (
        <div className="p-2">
          <button
            role="menuitem"
            onClick={onOpenInterns}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
            style={{ color: 'var(--text-1)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--surface-2)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <ManageIcon />
            Manage interns
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
            >
              {internCount}
            </span>
          </button>
        </div>
      )}

      {isAdmin && <div className="h-px" style={{ background: 'var(--line)' }} />}

      <div className="p-2">
        <button
          role="menuitem"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
          style={{ color: 'var(--st-cancelled-fg)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = 'var(--st-cancelled-bg)')
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOutIcon />
          Sign out
        </button>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: 'light' | 'dark'
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      className="grid h-[34px] w-[34px] place-items-center rounded-full transition"
      style={{ color: 'var(--text-2)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-wash)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function Avatar({ letter }: { letter: string }) {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold"
      style={{
        background: 'linear-gradient(135deg, var(--brand-orange), var(--accent))',
        color: '#fff',
      }}
    >
      {letter}
    </span>
  )
}

function GlowLayer({
  w,
  h,
  top,
  blur,
  rgb,
  a,
}: {
  w: number
  h: number
  top: number
  blur: number
  rgb: string
  a: number
}) {
  return (
    <span
      className="pointer-events-none absolute left-1/2 rounded-full"
      style={{
        width: w,
        height: h,
        top,
        marginLeft: -w / 2,
        background: `rgba(${rgb},${a})`,
        filter: `blur(${blur}px)`,
      }}
    />
  )
}

function glassStyle(theme: 'light' | 'dark', scrolled: boolean) {
  if (theme === 'dark') {
    return {
      background: 'rgba(16, 27, 56, 0.55)',
      border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: scrolled
        ? '0 12px 40px rgba(0,0,0,0.5), inset 0 1.5px 0 rgba(255,255,255,0.06)'
        : '0 8px 32px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.05)',
    }
  }
  return {
    background: 'rgba(255,255,255,0.30)',
    border: '1px solid rgba(255,255,255,0.28)',
    boxShadow: scrolled
      ? '0 12px 40px rgba(30,40,95,0.14), inset 0 1.5px 0 rgba(255,255,255,0.20)'
      : '0 8px 32px rgba(30,40,95,0.09), inset 0 1.5px 0 rgba(255,255,255,0.18)',
  }
}

function panelStyle(theme: 'light' | 'dark') {
  return {
    background: theme === 'dark' ? 'rgba(16,27,56,0.97)' : 'rgba(255,255,255,0.97)',
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    border: '1px solid var(--line)',
    borderRadius: 20,
    boxShadow:
      theme === 'dark'
        ? '0 30px 60px -20px rgba(0,0,0,0.7)'
        : '0 30px 60px -20px rgba(30,40,95,0.18)',
  } as const
}

/* -------------------------------------------------------------------------- */
/* Icons (stroke = currentColor)                                              */
/* -------------------------------------------------------------------------- */

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M21 20c0-2.5-1.4-4.7-3.5-5.6" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg {...iconProps} width={18} height={18}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg {...iconProps} width={18} height={18}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      {...iconProps}
      width={14}
      height={14}
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
function ManageIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="18" cy="6" r="2" />
      <path d="M18 8v3M16.3 7l-1.7 1M19.7 7l1.7 1" />
    </svg>
  )
}
function LogOutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </svg>
  )
}
function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={20}
      height={20}
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
