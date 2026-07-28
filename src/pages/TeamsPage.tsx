import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useTeams } from '../hooks/useTeams'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { TeamCard } from '../components/TeamCard'
import { AlertTriangleIcon, UsersIcon } from '../components/icons'
import { ROLE_LABELS, ROLE_ORDER } from '../types'
import { roleDotClass } from '../lib/roleStyles'

type ActiveType = 'team' | null

export function TeamsPage() {
  const api = useTeams()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const {
    teams,
    internsByTeam,
    projectsByTeam,
    internsByProject,
    loading,
    loadError,
    reload,
  } = api

  const [order, setOrder] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<ActiveType>(null)
  const draggingRef = useRef(false)

  const [addingTeam, setAddingTeam] = useState(false)
  const [teamDraft, setTeamDraft] = useState('')

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  // Keep local order in sync with canonical data, except mid-drag.
  useEffect(() => {
    if (draggingRef.current) return
    setOrder(teams.map((t) => t.id))
  }, [teams])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const onDragStart = (event: DragStartEvent) => {
    const type = (event.active.data.current?.type as ActiveType) ?? null
    draggingRef.current = true
    setActiveId(String(event.active.id))
    setActiveType(type)
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const type = (active.data.current?.type as ActiveType) ?? null
    draggingRef.current = false
    setActiveId(null)
    setActiveType(null)

    if (!over) return

    if (!isAdmin) {
      toast.error('Only admins can rearrange teams.')
      return
    }

    if (type === 'team') {
      const from = order.indexOf(String(active.id))
      const to = order.indexOf(String(over.id))
      if (from === -1 || to === -1 || from === to) return
      const next = arrayMove(order, from, to)
      setOrder(next)
      void api.reorderTeams(next)
    }
  }

  const commitTeam = () => {
    if (teamDraft.trim()) {
      void api.createTeam(teamDraft)
      setTeamDraft('')
      setAddingTeam(false)
    }
  }

  const activeTeam =
    activeType === 'team' && activeId ? teamById.get(activeId) : undefined

  return (
    <div className="h-full overflow-y-auto fi-scroll">
      <div className="mx-auto max-w-[100rem] px-5 py-6 sm:px-8">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Cohort{' '}
              <span className="bg-gradient-to-r from-sunburst-500 to-maroon-600 bg-clip-text text-transparent">
                Teams
              </span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
              <span>{teams.length} teams</span>
              <span className="hidden h-3 w-px bg-surface-3 sm:inline-block" />
              {ROLE_ORDER.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${roleDotClass[r]}`} />
                  {ROLE_LABELS[r]}
                </span>
              ))}
              {isAdmin ? (
                <>
                  <span className="hidden h-3 w-px bg-surface-3 sm:inline-block" />
                  <span className="text-ink-3">
                    Drag ⠿ to reorder · people follow their projects
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            addingTeam ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={teamDraft}
                  onChange={(e) => setTeamDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTeam()
                    if (e.key === 'Escape') {
                      setTeamDraft('')
                      setAddingTeam(false)
                    }
                  }}
                  placeholder="Team name…"
                  className="rounded-xl border border-line-2 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-sunburst-500"
                />
                <button
                  onClick={commitTeam}
                  className="rounded-xl bg-rail px-4 py-2 text-sm font-semibold text-rail-ink transition hover:opacity-90"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setTeamDraft('')
                    setAddingTeam(false)
                  }}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-ink-3 transition hover:bg-surface-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingTeam(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-rail px-4 py-2.5 text-sm font-semibold text-rail-ink shadow-e1 transition hover:opacity-90"
              >
                <span aria-hidden="true">＋</span> New team
              </button>
            )
          ) : null}
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={reload} />
        ) : teams.length === 0 ? (
          <EmptyState />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {order.map((teamId) => {
                  const team = teamById.get(teamId)
                  if (!team) return null
                  return (
                    <TeamCard
                      key={team.id}
                      team={team}
                      members={internsByTeam.get(team.id) ?? []}
                      projects={projectsByTeam.get(team.id) ?? []}
                      internsByProject={internsByProject}
                      api={api}
                      isAdmin={isAdmin}
                    />
                  )
                })}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeTeam ? (
                <div className="w-72 rotate-1 rounded-2xl border border-line-2 bg-surface px-4 py-3 shadow-e3">
                  <span className="text-base font-extrabold text-ink">
                    {activeTeam.name}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-line bg-surface p-5 shadow-e1"
        >
          <div className="fi-skeleton h-6 w-1/2 rounded" />
          <div className="fi-skeleton mt-3 h-5 w-2/3 rounded-full" />
          <div className="mt-4 space-y-2">
            <div className="fi-skeleton h-11 rounded-xl" />
            <div className="fi-skeleton h-11 rounded-xl" />
            <div className="fi-skeleton h-11 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 bg-surface py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600">
        <UsersIcon size={22} className="text-white" />
      </div>
      <h2 className="text-lg font-bold text-ink">No teams yet</h2>
      <p className="mt-1 text-sm text-ink-3">
        Teams will appear here once they're created.
      </p>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-st-pending bg-st-pending-bg p-8 text-center">
      <div className="mb-2 flex justify-center text-st-pending">
        <AlertTriangleIcon size={26} />
      </div>
      <h2 className="text-lg font-bold text-ink">Could not load teams</h2>
      <p className="mt-1 text-sm text-ink-3">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunburst-600"
      >
        Retry
      </button>
    </div>
  )
}
