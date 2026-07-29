import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Phase, Task } from '../types'
import type { UseProjectBoard } from '../hooks/useProjectBoard'
import { TaskCard } from './TaskCard'
import { CheckIcon, FileTextIcon, LockIcon } from './icons'

export function PhaseColumn({
  phase,
  tasks,
  board,
  cleared,
  isLast,
  locked,
  dragActive,
  shaking,
  onAdvance,
  onOpenReport,
  hasReport,
  isAdmin = false,
  currentUserId = null,
}: {
  phase: Phase
  tasks: Task[]
  board: UseProjectBoard
  cleared: boolean
  isLast: boolean
  locked: boolean
  dragActive: boolean
  shaking: boolean
  onAdvance: () => void
  onOpenReport: () => void
  hasReport: boolean
  isAdmin?: boolean
  currentUserId?: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: phase.id,
    data: { type: 'column', phaseId: phase.id },
    disabled: locked,
  })

  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(phase.name)
  const [adding, setAdding] = useState(false)
  const [taskDraft, setTaskDraft] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== phase.name) board.renamePhase(phase.id, trimmed)
    else setDraft(phase.name)
    setEditing(false)
  }

  const commitTask = () => {
    if (taskDraft.trim()) {
      board.addTask(phase.id, taskDraft)
      setTaskDraft('')
    }
  }

  const showValidDrop = isOver && dragActive && !locked
  const showBlockedDrop = !isAdmin && dragActive

  return (
    <div
      className={`flex h-full w-[19rem] shrink-0 flex-col rounded-2xl border bg-surface backdrop-blur-sm transition ${
        showBlockedDrop
          ? isOver
            ? 'border-[color:var(--st-cancelled)] bg-st-cancelled-bg ring-2 ring-[color:var(--st-cancelled)] cursor-not-allowed'
            : 'border-[color:var(--st-cancelled)] bg-st-cancelled-bg opacity-85 cursor-not-allowed'
          : showValidDrop
            ? 'border-sunburst-400 ring-2 ring-sunburst-400/50'
            : cleared
              ? 'border-st-approved'
              : 'border-line'
      } ${locked ? 'opacity-50' : ''} ${shaking ? 'animate-shake' : ''}`}
    >
      {/* Header */}
      <div className="rounded-t-2xl border-b border-line bg-surface-3 px-3.5 py-3 transition">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {editing && isAdmin ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') {
                    setDraft(phase.name)
                    setEditing(false)
                  }
                }}
                className="w-full rounded-md border border-line-2 bg-surface px-2 py-1 text-sm font-bold text-ink outline-none focus:border-sunburst-500"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                {locked ? (
                  <span title="Locked — clear this phase first" className="text-ink-3">
                    <LockIcon size={13} />
                  </span>
                ) : cleared ? (
                  <span
                    title="Phase cleared — all tasks approved"
                    className="text-st-approved-fg"
                  >
                    <CheckIcon size={14} />
                  </span>
                ) : null}
                <span
                  className="truncate text-sm font-bold text-ink"
                  title={phase.name}
                >
                  {phase.name}
                </span>
              </div>
            )}
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Week {phase.week_number}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[11px] font-bold text-ink-2">
              {tasks.length}
            </span>

            {/* Phase menu — admin: all actions; member + report: "View report" only; member + no report: hidden */}
            {isAdmin || hasReport ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-md px-1.5 py-0.5 text-ink-3 transition hover:bg-surface hover:text-ink-2"
                  aria-label="Phase options"
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-e2">
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenReport()
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-surface-2"
                    >
                      <FileTextIcon size={15} />
                      {hasReport ? 'View report' : 'Generate report'}
                    </button>
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => {
                            setDraft(phase.name)
                            setEditing(true)
                            setMenuOpen(false)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-surface-2"
                        >
                          Rename phase
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpen(false)
                            if (
                              window.confirm(
                                `Delete "${phase.name}"? Its tasks move to the first phase.`,
                              )
                            )
                              board.deletePhase(phase.id)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-st-cancelled-fg transition hover:bg-st-cancelled-bg"
                        >
                          Delete phase
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Advance / report — shown once every task in the phase is approved */}
        {cleared ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onOpenReport}
              title={hasReport ? 'View phase report' : 'Generate phase report'}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-accent-ring hover:text-accent"
            >
              <FileTextIcon size={13} /> Report
            </button>
            {isAdmin ? (
              isLast ? (
                <span className="flex-1 text-center text-[11px] font-medium text-ink-3">
                  Final phase
                </span>
              ) : (
                <button
                  onClick={onAdvance}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover"
                >
                  Advance phase →
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2.5 overflow-y-auto fi-scroll p-2.5"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              board={board}
              dragDisabled={false}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !adding ? (
          <div
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed py-6 text-center text-xs transition ${
              showValidDrop
                ? 'border-sunburst-400 text-sunburst-600'
                : 'border-line-2 text-ink-3'
            }`}
          >
            No tasks yet — add the first
            <br />
            deliverable for {phase.name}.
          </div>
        ) : null}

        {/* Add task */}
        {adding ? (
          <div className="rounded-xl border border-sunburst-200 bg-surface p-2">
            <textarea
              autoFocus
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitTask()
                }
                if (e.key === 'Escape') {
                  setTaskDraft('')
                  setAdding(false)
                }
              }}
              rows={2}
              placeholder="Task title…"
              className="w-full resize-none rounded-md border border-line-2 bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-sunburst-500"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={commitTask}
                className="rounded-md bg-sunburst-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sunburst-600"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setTaskDraft('')
                  setAdding(false)
                }}
                className="rounded-md px-2 py-1 text-xs font-medium text-ink-3 transition hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="m-2.5 mt-0 rounded-xl border border-dashed border-line-2 py-2 text-sm font-medium text-ink-3 transition hover:border-sunburst-400 hover:bg-sunburst-50/50 hover:text-sunburst-600"
        >
          + Add task
        </button>
      ) : null}
    </div>
  )
}
