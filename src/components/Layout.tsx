import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { InternManager } from './InternManager'
import { FloatingNav } from './FloatingNav'

export function Layout() {
  const [managerOpen, setManagerOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-plane">
      <a
        href="#main-content"
        className="fi-no-print sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-e3"
      >
        Skip to content
      </a>

      <FloatingNav onOpenInterns={() => setManagerOpen(true)} />

      <main id="main-content" className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {managerOpen ? (
        <InternManager onClose={() => setManagerOpen(false)} />
      ) : null}
    </div>
  )
}
