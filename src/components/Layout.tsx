import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInterns } from '../hooks/useInterns'
import { InternManager } from './InternManager'
import logoDark from '../assets/logo-dark.png'

export function Layout() {
  const { session, signOut } = useAuth()
  const { interns } = useInterns()
  const [managerOpen, setManagerOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-navy-50">
      <header className="z-30 flex shrink-0 items-center justify-between gap-4 bg-navy-900 px-5 py-3 text-white shadow-lift">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoDark}
            alt="FI Project Tracker"
            className="h-12 w-auto sm:h-14"
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/20"
          >
            <span aria-hidden="true">👥</span>
            <span className="hidden sm:inline">Interns</span>
            <span className="rounded-full bg-black/25 px-1.5 text-xs">
              {interns.length}
            </span>
          </button>

          <div className="hidden items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 sm:flex">
            <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-sunburst-500 to-maroon-600 text-center text-xs font-bold leading-6">
              {session?.user?.email?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="max-w-[14rem] truncate text-xs text-white/70">
              {session?.user?.email}
            </span>
          </div>

          <button
            onClick={() => void signOut()}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Sign out
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
