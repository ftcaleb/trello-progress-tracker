import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Comment, Phase } from '../types'

const WIDTH = 344
const MAX_HEIGHT = 440

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function CommentsPopover({
  anchorEl,
  comments,
  phases,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: {
  anchorEl: HTMLElement
  comments: Comment[]
  phases: Phase[]
  onAdd: (content: string) => void
  onUpdate: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  })
  const [draft, setDraft] = useState('')

  const reposition = () => {
    const r = anchorEl.getBoundingClientRect()
    const spaceRight = window.innerWidth - r.right
    const left =
      spaceRight > WIDTH + 16
        ? r.right + 8
        : Math.max(8, r.left - WIDTH - 8)
    const top = Math.min(
      Math.max(8, r.top),
      window.innerHeight - MAX_HEIGHT - 8,
    )
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    reposition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl])

  useEffect(() => {
    const onScroll = () => reposition()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      )
        onClose()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl, onClose])

  const phaseById = useMemo(
    () => new Map(phases.map((p) => [p.id, p])),
    [phases],
  )

  const groups = useMemo(() => {
    const byPhase = new Map<string | null, Comment[]>()
    for (const c of comments) {
      const list = byPhase.get(c.phase_id) ?? []
      list.push(c)
      byPhase.set(c.phase_id, list)
    }
    const result: { phase: Phase | null; comments: Comment[] }[] = []
    for (const [key, list] of byPhase.entries()) {
      const phase = key ? (phaseById.get(key) ?? null) : null
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      result.push({ phase: key && phase ? phase : null, comments: sorted })
    }
    result.sort((a, b) => {
      if (!a.phase) return 1
      if (!b.phase) return -1
      return a.phase.position - b.phase.position
    })
    return result
  }, [comments, phaseById])

  const submit = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: WIDTH,
        maxHeight: MAX_HEIGHT,
      }}
      className="z-[60] flex animate-fade-in flex-col overflow-hidden rounded-xl border border-navy-100 bg-white shadow-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-navy-100 px-3.5 py-2.5">
        <span className="text-sm font-bold text-navy-900">Comments</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
          aria-label="Close comments"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto fi-scroll px-3.5 py-3">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy-400">
            No comments yet. Start the thread below.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group, gi) => (
              <div key={group.phase?.id ?? `unphased-${gi}`}>
                <div className="sticky top-0 z-10 -mx-3.5 mb-2 bg-white/95 px-3.5 py-1 backdrop-blur">
                  <span className="inline-block rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-500">
                    {group.phase
                      ? `${group.phase.name} · Week ${group.phase.week_number}`
                      : 'Unphased'}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.comments.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-navy-100 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          rows={2}
          placeholder="Write a comment…"
          className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-navy-300">⌘/Ctrl + Enter</span>
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="rounded-lg bg-sunburst-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sunburst-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CommentItem({
  comment,
  onUpdate,
  onDelete,
}: {
  comment: Comment
  onUpdate: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)

  const edited =
    new Date(comment.updated_at).getTime() -
      new Date(comment.created_at).getTime() >
    1500

  if (editing) {
    return (
      <li className="rounded-lg border border-sunburst-200 bg-sunburst-50/40 p-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          className="w-full resize-none rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-900 outline-none focus:border-sunburst-500"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => {
              setDraft(comment.content)
              setEditing(false)
            }}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-navy-500 transition hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (draft.trim()) {
                onUpdate(comment.id, draft)
                setEditing(false)
              }
            }}
            className="rounded-md bg-maroon-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-maroon-700"
          >
            Save
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="group rounded-lg border border-navy-100 bg-navy-50/40 p-2.5">
      <p className="whitespace-pre-wrap text-sm text-navy-800">
        {comment.content}
      </p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-navy-400">
          {formatTimestamp(comment.created_at)}
          {edited ? <span className="ml-1 italic">(edited)</span> : null}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={() => {
              setDraft(comment.content)
              setEditing(true)
            }}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-navy-500 transition hover:bg-white hover:text-navy-800"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete this comment?')) onDelete(comment.id)
            }}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-navy-400 transition hover:bg-white hover:text-sunburst-600"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}
