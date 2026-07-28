import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { InternManager } from './InternManager'
import { FloatingNav } from './FloatingNav'

export function Layout() {
  const [managerOpen, setManagerOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-plane">
      <FloatingNav onOpenInterns={() => setManagerOpen(true)} />

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {managerOpen ? (
        <InternManager onClose={() => setManagerOpen(false)} />
      ) : null}
    </div>
  )
}
