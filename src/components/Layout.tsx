import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInterns } from '../hooks/useInterns'
import { InternManager } from './InternManager'
import logoDark from '../assets/logo-dark.png'

export function Layout() {
  const { session, profile, signOut, isAdmin } = useAuth()
  const { interns } = useInterns()
  const [managerOpen, setManagerOpen] = useState(false)

  // Prefer real identity from the profile; the auth email is a synthetic
  // placeholder when Moodle withholds the address.
  const displayName =
    profile?.full_name?.trim() ||
    (profile?.moodle_username ? `@${profile.moodle_username}` : null) ||
    session?.user?.email ||
    'Signed in'
  const avatarLetter = (
    profile?.full_name?.trim()?.[0] ??
    profile?.moodle_username?.[0] ??
    session?.user?.email?.[0] ??
    '?'
  ).toUpperCase()

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-sm font-semibold transition sm:px-3 ${
      isActive
        ? 'border-sunburst-400 bg-sunburst-500 text-white'
        : 'border-white/15 bg-white/10 text-white hover:bg-white/20'
    }`

  return (
    <div className="flex h-screen flex-col bg-navy-50">
      <header className="z-30 flex shrink-0 items-center justify-between gap-2 bg-navy-900 px-3 py-2.5 text-white shadow-lift sm:gap-4 sm:px-5 sm:py-3">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <img
            src={logoDark}
            alt="FI Project Tracker"
            className="h-8 w-auto max-w-[8rem] object-contain sm:h-14 sm:max-w-none"
          />
        </Link>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <NavLink to="/" end className={navLinkClass}>
            <span aria-hidden="true">🏠</span>
            <span className="hidden sm:inline">Home</span>
          </NavLink>

          <NavLink to="/teams" className={navLinkClass}>
            <span aria-hidden="true">👥</span>
            <span className="hidden sm:inline">Teams</span>
          </NavLink>

          <NavLink to="/attendance" className={navLinkClass}>
            <span aria-hidden="true">🗓️</span>
            <span className="hidden sm:inline">Attendance</span>
          </NavLink>

          {isAdmin ? (
            <NavLink to="/admin" className={navLinkClass}>
              <span aria-hidden="true">🛡️</span>
              <span className="hidden sm:inline">Admin</span>
            </NavLink>
          ) : null}

          {isAdmin ? (
            <button
              onClick={() => setManagerOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-sm font-medium transition hover:bg-white/20 sm:px-3"
            >
              <span aria-hidden="true">🧑‍💼</span>
              <span className="hidden sm:inline">Interns</span>
              <span className="rounded-full bg-black/25 px-1.5 text-xs">
                {interns.length}
              </span>
            </button>
          ) : null}

          <div className="hidden min-w-0 items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 lg:flex">
            <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-sunburst-500 to-maroon-600 text-center text-xs font-bold leading-6">
              {avatarLetter}
            </span>
            <span className="max-w-[10rem] truncate text-xs text-white/70">
              {displayName}
            </span>
          </div>

          <button
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-2.5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:px-3"
          >
            <span aria-hidden="true">⏻</span>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {managerOpen ? (
        <InternManager onClose={() => setManagerOpen(false)} />
      ) : null}
    </div>
  )
}
