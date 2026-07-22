import { useEffect, useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import type { UseProjectBoard } from '../hooks/useProjectBoard'
import { StatusSelect } from './StatusSelect'
import { CommentsPopover } from './CommentsPopover'

export function TaskCard({
  task,
  board,
  dragDisabled = false,
}: {
  task: Task
  board: UseProjectBoard
  dragDisabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', phaseId: task.phase_id },
    disabled: dragDisabled,
  })

  const [title, setTitle] = useState(task.title)
  const [menuOpen, setMenuOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const commentBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setTitle(task.title), [task.title])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const commentCount = board.commentCountByTask.get(task.id) ?? 0
  const taskComments = useMemo(
    () => board.comments.filter((c) => c.task_id === task.id),
    [board.comments, task.id],
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const saveTitle = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) board.updateTaskTitle(task.id, trimmed)
    else setTitle(task.title)
  }

  const stop = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group rounded-xl border border-navy-100 bg-white p-3 shadow-card transition ${
        dragDisabled ? '' : 'cursor-grab active:cursor-grabbing'
      } hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lift ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {/* Title (inline editable) */}
      <div className="mb-2.5 flex items-start gap-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPointerDown={stop}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setTitle(task.title)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-navy-900 outline-none transition hover:border-navy-100 focus:border-navy-200 focus:bg-navy-50/50"
        />

        {/* Card menu */}
        <div className="relative" ref={menuRef}>
          <button
            onPointerDown={stop}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md px-1.5 py-0.5 text-navy-300 opacity-0 transition hover:bg-navy-50 hover:text-navy-600 group-hover:opacity-100"
            aria-label="Task options"
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-7 z-30 w-32 overflow-hidden rounded-lg border border-navy-100 bg-white py-1 shadow-pop">
              <button
                onPointerDown={stop}
                onClick={() => {
                  setMenuOpen(false)
                  if (window.confirm(`Delete task "${task.title}"?`))
                    board.deleteTask(task.id)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                Delete task
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer: status + comments */}
      <div className="flex items-center justify-between gap-2">
        <div onPointerDown={stop}>
          <StatusSelect
            value={task.status}
            onChange={(status) => board.setTaskStatus(task.id, status)}
          />
        </div>

        <button
          ref={commentBtnRef}
          onPointerDown={stop}
          onClick={() => setCommentsOpen((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
            commentCount > 0
              ? 'text-navy-600 hover:bg-navy-50'
              : 'text-navy-400 hover:bg-navy-50'
          }`}
          title="Comments"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount}
        </button>
      </div>

      {commentsOpen && commentBtnRef.current ? (
        <CommentsPopover
          anchorEl={commentBtnRef.current}
          comments={taskComments}
          phases={board.phases}
          onAdd={(content) => board.addComment(task.id, content)}
          onUpdate={board.updateComment}
          onDelete={board.deleteComment}
          onClose={() => setCommentsOpen(false)}
        />
      ) : null}
    </div>
  )
}
