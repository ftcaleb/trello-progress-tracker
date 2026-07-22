import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Phase, Task } from '../types'
import type { UseProjectBoard } from '../hooks/useProjectBoard'
import { TaskCard } from './TaskCard'

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

  return (
    <div
      className={`flex h-full w-[19rem] shrink-0 flex-col rounded-2xl border bg-white/70 backdrop-blur-sm transition ${
        showValidDrop
          ? 'border-sunburst-400 ring-2 ring-sunburst-400/50'
          : cleared
            ? 'border-maroon-200'
            : 'border-navy-100'
      } ${locked ? 'opacity-50' : ''} ${shaking ? 'animate-shake' : ''}`}
    >
      {/* Header */}
      <div
        className={`rounded-t-2xl border-b px-3.5 py-3 transition ${
          cleared
            ? 'border-maroon-100 bg-gradient-to-r from-maroon-50 to-sunburst-50'
            : 'border-navy-100 bg-navy-50/60'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {editing ? (
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
                className="w-full rounded-md border border-navy-200 bg-white px-2 py-1 text-sm font-bold text-navy-900 outline-none focus:border-sunburst-500"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                {locked ? (
                  <span title="Locked — clear this phase first" aria-hidden="true">
                    🔒
                  </span>
                ) : null}
                <span
                  className="truncate text-sm font-bold text-navy-900"
                  title={phase.name}
                >
                  {phase.name}
                </span>
              </div>
            )}
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
              Week {phase.week_number}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-100 px-1.5 text-[11px] font-bold text-navy-600">
              {tasks.length}
            </span>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-md px-1.5 py-0.5 text-navy-400 transition hover:bg-white hover:text-navy-700"
                aria-label="Phase options"
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-lg border border-navy-100 bg-white py-1 shadow-pop">
                  <button
                    onClick={() => {
                      setDraft(phase.name)
                      setEditing(true)
                      setMenuOpen(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-navy-700 transition hover:bg-navy-50"
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
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    Delete phase
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Cleared state / advance */}
        {cleared ? (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-maroon-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              Phase cleared ✓
            </span>
            {isLast ? (
              <span className="text-[11px] font-medium text-navy-400">
                Final phase
              </span>
            ) : (
              <button
                onClick={onAdvance}
                className="rounded-lg bg-gradient-to-r from-sunburst-500 to-maroon-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                Advance phase →
              </button>
            )}
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
            <TaskCard key={task.id} task={task} board={board} />
          ))}
        </SortableContext>

        {tasks.length === 0 && !adding ? (
          <div
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed py-6 text-center text-xs transition ${
              showValidDrop
                ? 'border-sunburst-400 text-sunburst-600'
                : 'border-navy-200 text-navy-400'
            }`}
          >
            No tasks yet — add the first
            <br />
            deliverable for {phase.name}.
          </div>
        ) : null}

        {/* Add task */}
        {adding ? (
          <div className="rounded-xl border border-sunburst-200 bg-white p-2">
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
              className="w-full resize-none rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-900 outline-none focus:border-sunburst-500"
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
                className="rounded-md px-2 py-1 text-xs font-medium text-navy-500 transition hover:bg-navy-50"
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
          className="m-2.5 mt-0 rounded-xl border border-dashed border-navy-200 py-2 text-sm font-medium text-navy-500 transition hover:border-sunburst-400 hover:bg-sunburst-50/50 hover:text-sunburst-600"
        >
          + Add task
        </button>
      ) : null}
    </div>
  )
}
