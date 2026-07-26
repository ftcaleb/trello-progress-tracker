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
import { ROLE_LABELS, ROLE_ORDER } from '../types'
import { roleDotClass } from '../lib/roleStyles'

type ActiveType = 'team' | 'member' | null

export function TeamsPage() {
  const api = useTeams()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const {
    teams,
    members,
    membersByTeam,
    projectsByTeam,
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
      return
    }

    if (type === 'member') {
      const fromTeam = active.data.current?.teamId as string | undefined
      const overId = String(over.id)
      const targetTeam = teamById.has(overId) ? overId : undefined
      if (targetTeam && fromTeam && targetTeam !== fromTeam) {
        void api.moveMember(String(active.id), targetTeam)
      }
    }
  }

  const commitTeam = () => {
    if (teamDraft.trim()) {
      void api.createTeam(teamDraft)
      setTeamDraft('')
      setAddingTeam(false)
    }
  }

  const activeMember =
    activeType === 'member' && activeId
      ? members.find((m) => m.id === activeId)
      : undefined
  const activeTeam =
    activeType === 'team' && activeId ? teamById.get(activeId) : undefined

  return (
    <div className="h-full overflow-y-auto fi-scroll">
      <div className="mx-auto max-w-[100rem] px-5 py-6 sm:px-8">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
              Cohort{' '}
              <span className="bg-gradient-to-r from-sunburst-500 to-maroon-600 bg-clip-text text-transparent">
                Teams
              </span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-400">
              <span>{teams.length} teams</span>
              <span className="hidden h-3 w-px bg-navy-200 sm:inline-block" />
              {ROLE_ORDER.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${roleDotClass[r]}`} />
                  {ROLE_LABELS[r]}
                </span>
              ))}
              {isAdmin ? (
                <>
                  <span className="hidden h-3 w-px bg-navy-200 sm:inline-block" />
                  <span className="text-navy-400">
                    Drag ⠿ to reorder · drag a member to reassign
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
                  className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none focus:border-sunburst-500"
                />
                <button
                  onClick={commitTeam}
                  className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setTeamDraft('')
                    setAddingTeam(false)
                  }}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-navy-500 transition hover:bg-navy-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingTeam(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800"
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
              <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {order.map((teamId) => {
                  const team = teamById.get(teamId)
                  if (!team) return null
                  return (
                    <TeamCard
                      key={team.id}
                      team={team}
                      members={membersByTeam.get(team.id) ?? []}
                      projects={projectsByTeam.get(team.id) ?? []}
                      api={api}
                      isAdmin={isAdmin}
                      activeType={activeType}
                    />
                  )
                })}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeMember ? (
                <div className="flex w-56 items-center gap-2 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 shadow-lift">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${roleDotClass[activeMember.role]}`}
                  />
                  <span className="truncate text-[13px] font-medium text-navy-900">
                    {activeMember.name}
                  </span>
                </div>
              ) : activeTeam ? (
                <div className="w-72 rotate-1 rounded-2xl border border-navy-200 bg-white px-4 py-3 shadow-lift">
                  <span className="text-base font-extrabold text-navy-900">
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
          className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card"
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
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600 text-xl">
        👥
      </div>
      <h2 className="text-lg font-bold text-navy-900">No teams yet</h2>
      <p className="mt-1 text-sm text-navy-400">
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
    <div className="mx-auto max-w-md rounded-2xl border border-sunburst-200 bg-sunburst-50/50 p-8 text-center">
      <div className="mb-2 text-2xl">⚠️</div>
      <h2 className="text-lg font-bold text-navy-900">Could not load teams</h2>
      <p className="mt-1 text-sm text-navy-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunburst-600"
      >
        Retry
      </button>
    </div>
  )
}
