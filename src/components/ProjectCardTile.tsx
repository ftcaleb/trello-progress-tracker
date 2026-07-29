import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Intern, Project, Team } from '../types'
import { WEEKDAY_SHORT } from '../types'
import type { ProjectProgress } from '../hooks/usePortfolio'
import { useAuth } from '../hooks/useAuth'
import { AvatarStack } from './Avatar'
import { AssignPopover } from './AssignPopover'
import { Popover } from './Popover'
import { ClockIcon, FileTextIcon, TrashIcon } from './icons'

export function ProjectCardTile({
  project,
  progress,
  interns,
  allInterns,
  reportCount,
  teams,
  onToggleAssign,
  onSetGroup,
  onDelete,
}: {
  project: Project
  progress: ProjectProgress
  interns: Intern[]
  allInterns: Intern[]
  reportCount: number
  teams: Team[]
  onToggleAssign: (internId: string, assigned: boolean) => void
  onSetGroup: (teamId: string | null) => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [assignOpen, setAssignOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const assignBtnRef = useRef<HTMLButtonElement>(null)
  const groupBtnRef = useRef<HTMLButtonElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const assignedIds = new Set(interns.map((i) => i.id))

  const total = progress.totalPhases
  const completed = progress.completedPhases
  const phaseLabel =
    progress.percent === 100 && total > 0
      ? 'All phases approved'
      : progress.started && progress.currentPhase
        ? `${progress.currentPhase.name} · Week ${progress.currentPhase.week_number}`
        : 'Not started'
  const group = teams.find((t) => t.id === project.team_id) ?? null

  const closeMenu = () => {
    setMenuOpen(false)
    setConfirmDelete(false)
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-line bg-surface p-5 shadow-e1 transition duration-150 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-e3"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">
            {project.name}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">
            {project.description || 'No description yet.'}
          </p>
        </div>

        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="relative">
              <button
                ref={assignBtnRef}
                onClick={(e) => {
                  stop(e)
                  setAssignOpen((v) => !v)
                }}
                className="rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-sunburst-400 hover:text-sunburst-600"
              >
                + Assign
              </button>
              {assignOpen ? (
                <AssignPopover
                  anchorEl={assignBtnRef.current}
                  interns={allInterns}
                  assignedIds={assignedIds}
                  onToggle={onToggleAssign}
                  onClose={() => setAssignOpen(false)}
                />
              ) : null}
            </div>

            <button
              ref={menuBtnRef}
              onClick={(e) => {
                stop(e)
                setMenuOpen((v) => !v)
              }}
              aria-label="Project options"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line-2 text-ink-3 transition hover:border-line-2 hover:bg-surface-2 hover:text-ink"
            >
              <span className="text-base leading-none">⋯</span>
            </button>
            {menuOpen ? (
              <Popover
                anchorEl={menuBtnRef.current}
                onClose={closeMenu}
                width={220}
                align="right"
              >
                {confirmDelete ? (
                  <div className="p-3">
                    <p className="mb-2 text-xs leading-snug text-ink-2">
                      Delete <span className="font-semibold">{project.name}</span>?
                      This removes its board, assignments and attendance.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          stop(e)
                          onDelete()
                          closeMenu()
                        }}
                        className="flex-1 rounded-lg bg-st-cancelled-bg py-1.5 text-xs font-bold text-st-cancelled-fg transition hover:opacity-90"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          stop(e)
                          setConfirmDelete(false)
                        }}
                        className="flex-1 rounded-lg border border-line-2 py-1.5 text-xs font-semibold text-ink-2 transition hover:bg-surface-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      stop(e)
                      setConfirmDelete(true)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-st-cancelled-fg transition hover:bg-st-cancelled-bg"
                  >
                    <TrashIcon size={14} /> Delete project
                  </button>
                )}
              </Popover>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Group link */}
      <div className="mt-3">
        {isAdmin ? (
          <>
            <button
              ref={groupBtnRef}
              onClick={(e) => {
                stop(e)
                setGroupOpen((v) => !v)
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                group
                  ? 'border-accent-ring bg-accent-wash text-accent hover:bg-accent-wash-2'
                  : 'border-dashed border-line-2 text-ink-3 hover:border-sunburst-400 hover:text-sunburst-600'
              }`}
            >
              <span aria-hidden="true">◇</span>
              {group ? group.name : 'Add to group'}
              <span className="opacity-60">▾</span>
            </button>
            {groupOpen ? (
              <Popover
                anchorEl={groupBtnRef.current}
                onClose={() => setGroupOpen(false)}
                width={224}
                align="left"
              >
                <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  Move to group
                </div>
                <div className="max-h-64 overflow-y-auto fi-scroll py-1">
                  <GroupItem
                    label="Unassigned"
                    muted
                    selected={project.team_id === null}
                    onClick={() => {
                      onSetGroup(null)
                      setGroupOpen(false)
                    }}
                  />
                  {teams.map((t) => (
                    <GroupItem
                      key={t.id}
                      label={t.name}
                      selected={project.team_id === t.id}
                      onClick={() => {
                        onSetGroup(t.id)
                        setGroupOpen(false)
                      }}
                    />
                  ))}
                </div>
              </Popover>
            ) : null}
          </>
        ) : group ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-ring bg-accent-wash px-2.5 py-1 text-xs font-semibold text-accent">
            <span aria-hidden="true">◇</span>
            {group.name}
          </span>
        ) : null}
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span
            className="line-clamp-2 text-xs font-semibold leading-snug text-ink-2"
            title={phaseLabel}
          >
            {phaseLabel}
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums leading-none text-ink">
            {progress.percent}
            <span className="text-[10px] font-semibold text-ink-3">%</span>
          </span>
        </div>
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Project progress: ${completed} of ${total} phases approved`}
        >
          {total > 0 ? (
            Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < completed
                    ? 'bg-gradient-to-r from-sunburst-400 to-sunburst-600'
                    : 'bg-surface-3'
                }`}
              />
            ))
          ) : (
            <span className="h-1.5 flex-1 rounded-full bg-surface-3" />
          )}
        </div>
      </div>

      {/* Footer: avatars + standup */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        {interns.length > 0 ? (
          <AvatarStack interns={interns} max={4} />
        ) : (
          <span className="text-xs text-ink-3">Unassigned</span>
        )}

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-3"
            title={`${reportCount} saved report${reportCount === 1 ? '' : 's'}`}
          >
            <FileTextIcon size={13} />
            {reportCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-ink-2">
            <ClockIcon size={13} />
            {WEEKDAY_SHORT[project.standup_day] ?? project.standup_day}{' '}
            {project.standup_time?.slice(0, 5)}
          </span>
        </div>
      </div>
    </div>
  )
}

function GroupItem({
  label,
  selected,
  muted,
  onClick,
}: {
  label: string
  selected: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-2 ${
        selected ? 'font-semibold text-ink' : muted ? 'text-ink-3' : 'text-ink-2'
      }`}
    >
      <span className="truncate">{label}</span>
      {selected ? <span className="text-accent">●</span> : null}
    </button>
  )
}
