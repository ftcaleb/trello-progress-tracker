import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangleIcon, SettingsIcon } from '../components/icons'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useProjectBoard } from '../hooks/useProjectBoard'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { STATUS_LABELS, type Task } from '../types'
import { PhaseColumn } from '../components/PhaseColumn'
import { SettingsModal } from '../components/SettingsModal'
import { ReportModal } from '../components/ReportModal'
import { AvatarStack } from '../components/Avatar'

type Containers = Record<string, string[]>

export function BoardPage() {
  const { id = '' } = useParams()
  const board = useProjectBoard(id)
  const toast = useToast()
  const { isAdmin, session } = useAuth()
  const currentUserId = session?.user?.id ?? null

  const {
    project,
    phases,
    tasks,
    tasksByPhase,
    isPhaseCleared,
    assignedInterns,
    loading,
    loadError,
    reload,
    commitTasks,
    advancePhase,
    addPhase,
  } = board

  const [containers, setContainers] = useState<Containers>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const dragSource = useRef<{ phaseId: string; cleared: boolean } | null>(null)
  const [shakePhaseId, setShakePhaseId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportPhaseId, setReportPhaseId] = useState<string | null>(null)

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const phasePos = useMemo(() => {
    const m = new Map<string, number>()
    phases.forEach((p, i) => m.set(p.id, i))
    return m
  }, [phases])

  const buildContainers = useCallback((): Containers => {
    const next: Containers = {}
    for (const ph of phases) {
      next[ph.id] = (tasksByPhase.get(ph.id) ?? []).map((t) => t.id)
    }
    return next
  }, [phases, tasksByPhase])

  // Rebuild from canonical data, except mid-drag.
  useEffect(() => {
    if (activeIdRef.current) return
    setContainers(buildContainers())
  }, [buildContainers])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const findContainer = (cid: string, source: Containers): string | undefined => {
    if (cid in source) return cid
    return Object.keys(source).find((key) => source[key].includes(cid))
  }

  const isLockedTarget = (phaseId: string): boolean => {
    const src = dragSource.current
    if (!src || src.cleared) return false
    const srcPos = phasePos.get(src.phaseId) ?? -1
    const tgtPos = phasePos.get(phaseId) ?? -1
    return tgtPos > srcPos
  }

  const onDragStart = (event: DragStartEvent) => {
    const aId = String(event.active.id)
    const task = taskById.get(aId)
    activeIdRef.current = aId
    setActiveId(aId)
    if (task) {
      dragSource.current = {
        phaseId: task.phase_id,
        cleared: isPhaseCleared(task.phase_id),
      }
    }
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const aId = String(active.id)
    const oId = String(over.id)

    setContainers((prev) => {
      const activeC = findContainer(aId, prev)
      const overC = findContainer(oId, prev)
      if (!activeC || !overC || activeC === overC) return prev
      // Block live entry into a locked (forward) column.
      if (isLockedTarget(overC)) return prev

      const activeItems = prev[activeC]
      const overItems = prev[overC]
      const overIndex = overItems.indexOf(oId)
      const insertAt =
        oId in prev
          ? overItems.length
          : overIndex >= 0
            ? overIndex
            : overItems.length

      return {
        ...prev,
        [activeC]: activeItems.filter((x) => x !== aId),
        [overC]: [
          ...overItems.slice(0, insertAt),
          aId,
          ...overItems.slice(insertAt),
        ],
      }
    })
  }

  const triggerShake = (phaseId: string) => {
    setShakePhaseId(phaseId)
    window.setTimeout(() => setShakePhaseId(null), 500)
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const aId = String(active.id)
    const src = dragSource.current
    activeIdRef.current = null
    setActiveId(null)
    dragSource.current = null

    if (!isAdmin) {
      toast.error('Only admins can move tasks between phases.')
      setContainers(buildContainers())
      return
    }

    if (!over || !src) {
      setContainers(buildContainers())
      return
    }
    const oId = String(over.id)
    const cardContainer = findContainer(aId, containers)
    const overContainer = findContainer(oId, containers)
    if (!cardContainer || !overContainer) {
      setContainers(buildContainers())
      return
    }

    const srcPos = phasePos.get(src.phaseId) ?? -1
    const overPos = phasePos.get(overContainer) ?? -1

    // Phase gate: forward move blocked unless the source phase is cleared.
    if (overPos > srcPos && !src.cleared) {
      const notApproved = (tasksByPhase.get(src.phaseId) ?? []).filter(
        (t) => t.status !== 'approved',
      ).length
      const phaseName =
        phases.find((p) => p.id === src.phaseId)?.name ?? 'This phase'
      triggerShake(src.phaseId)
      toast.error(
        `${phaseName} not cleared — ${notApproved} task${
          notApproved === 1 ? '' : 's'
        } not yet approved.`,
      )
      setContainers(buildContainers())
      return
    }

    // Accepted — finalize ordering.
    let finalContainers = containers
    if (cardContainer === overContainer) {
      const items = containers[cardContainer]
      const oldIndex = items.indexOf(aId)
      const newIndex =
        oId === cardContainer ? items.length - 1 : items.indexOf(oId)
      if (oldIndex !== newIndex && newIndex >= 0) {
        finalContainers = {
          ...containers,
          [cardContainer]: arrayMove(items, oldIndex, newIndex),
        }
        setContainers(finalContainers)
      }
    }

    const updated: Task[] = []
    for (const phaseId of Object.keys(finalContainers)) {
      finalContainers[phaseId].forEach((tid, idx) => {
        const orig = taskById.get(tid)
        if (orig) updated.push({ ...orig, phase_id: phaseId, position: idx })
      })
    }
    void commitTasks(updated, 'Could not save changes')
  }

  const handleAddPhase = () => {
    const name = window.prompt(
      'Name for the new phase:',
      `Phase ${phases.length + 1}`,
    )
    if (name === null) return
    void addPhase(name)
  }

  const handleAdvance = (phaseId: string) => {
    const list = tasksByPhase.get(phaseId) ?? []
    const target = phases[phases.findIndex((p) => p.id === phaseId) + 1]
    if (!target) return
    if (
      window.confirm(
        `Advance ${list.length} task${list.length === 1 ? '' : 's'} to ${target.name}? Statuses reset to In Progress.`,
      )
    )
      void advancePhase(phaseId)
  }

  const activeTask = activeId ? taskById.get(activeId) : undefined
  const dragActive = Boolean(activeId)

  if (loading) return <BoardSkeleton />
  if (loadError || !project)
    return <BoardError message={loadError ?? 'Project not found.'} onRetry={reload} />

  return (
    <div className="flex h-full flex-col">
      {/* Board header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="rounded-lg border border-line-2 px-2.5 py-1.5 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
          >
            ← Portfolio
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">
              {project.name}
            </h1>
            {project.description ? (
              <p className="truncate text-xs text-ink-3">
                {project.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {assignedInterns.length > 0 ? (
            <AvatarStack interns={assignedInterns} max={5} />
          ) : (
            <span className="text-xs text-ink-3">No team assigned</span>
          )}
          {isAdmin ? (
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
            >
              <SettingsIcon size={15} /> Settings
            </button>
          ) : null}
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 items-stretch gap-4 overflow-x-auto fi-scroll p-5">
          {phases.map((phase, idx) => {
            const ids = containers[phase.id] ?? []
            const columnTasks = ids
              .map((tid) => taskById.get(tid))
              .filter((t): t is Task => Boolean(t))
            return (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                tasks={columnTasks}
                board={board}
                cleared={isPhaseCleared(phase.id)}
                isLast={idx === phases.length - 1}
                locked={dragActive && isLockedTarget(phase.id)}
                dragActive={dragActive}
                shaking={shakePhaseId === phase.id}
                onAdvance={() => handleAdvance(phase.id)}
                onOpenReport={() => setReportPhaseId(phase.id)}
                hasReport={board.reportsByPhase.has(phase.id)}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
              />
            )
          })}

          {isAdmin ? (
            <div className="w-[19rem] shrink-0">
              <button
                onClick={handleAddPhase}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-2 bg-surface px-4 py-3 text-sm font-medium text-ink-3 transition hover:border-sunburst-400 hover:bg-sunburst-50/50 hover:text-sunburst-600"
              >
                <span className="text-lg leading-none">+</span> Add phase
              </button>
            </div>
          ) : null}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-[17rem] rotate-2 rounded-xl border border-line-2 bg-surface p-3 shadow-e3">
              <div className="mb-2 text-sm font-semibold text-ink">
                {activeTask.title}
              </div>
              <span className="text-xs text-ink-3">
                {STATUS_LABELS[activeTask.status]}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {settingsOpen ? (
        <SettingsModal
          project={project}
          onSave={board.updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {reportPhaseId
        ? (() => {
            const rp = phases.find((p) => p.id === reportPhaseId)
            return rp ? (
              <ReportModal
                phase={rp}
                board={board}
                onClose={() => setReportPhaseId(null)}
              />
            ) : null
          })()
        : null}
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex h-full gap-4 overflow-hidden p-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex h-full w-[19rem] shrink-0 flex-col rounded-2xl border border-line bg-surface"
        >
          <div className="fi-skeleton h-14 rounded-t-2xl" />
          <div className="space-y-2.5 p-2.5">
            <div className="fi-skeleton h-16 rounded-xl" />
            <div className="fi-skeleton h-16 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function BoardError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-st-pending bg-st-pending-bg p-8 text-center">
        <div className="mb-2 flex justify-center text-st-pending">
          <AlertTriangleIcon size={26} />
        </div>
        <h2 className="text-lg font-bold text-ink">
          Could not load this project
        </h2>
        <p className="mt-1 text-sm text-ink-3">{message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            to="/"
            className="rounded-xl border border-line-2 px-4 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface"
          >
            Back to portfolio
          </Link>
          <button
            onClick={onRetry}
            className="rounded-xl bg-sunburst-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunburst-600"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}
