import { useEffect, useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Intern, Project, Team } from '../types'
import { AvatarStack } from './Avatar'
import type { UseTeams } from '../hooks/useTeams'
import { Popover } from './Popover'

/** One project inside a group: its name, its assigned devs, and a move menu. */
function ProjectRow({
  project,
  devs,
  teams,
  isAdmin,
  onMove,
}: {
  project: Project
  devs: Intern[]
  teams: Team[]
  isAdmin: boolean
  onMove: (teamId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="border-b border-line px-3 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-ink">
          {project.name}
        </span>
        {isAdmin ? (
          <div className="relative shrink-0">
            <button
              ref={btnRef}
              onClick={() => setOpen((v) => !v)}
              aria-label="Move project"
              className="grid h-6 w-6 place-items-center rounded text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            >
              <span className="text-base leading-none">⋯</span>
            </button>
            {open ? (
              <Popover
                anchorEl={btnRef.current}
                onClose={() => setOpen(false)}
                width={220}
                align="right"
              >
                <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  Move project to
                </div>
                <div className="max-h-64 overflow-y-auto fi-scroll py-1">
                  <MoveItem
                    label="Unassigned"
                    muted
                    selected={project.team_id === null}
                    onClick={() => {
                      onMove(null)
                      setOpen(false)
                    }}
                  />
                  {teams.map((t) => (
                    <MoveItem
                      key={t.id}
                      label={t.name}
                      selected={project.team_id === t.id}
                      onClick={() => {
                        onMove(t.id)
                        setOpen(false)
                      }}
                    />
                  ))}
                </div>
              </Popover>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-1.5">
        {devs.length > 0 ? (
          <AvatarStack interns={devs} max={6} />
        ) : (
          <span className="text-[11px] text-ink-3">No interns assigned yet</span>
        )}
      </div>
    </div>
  )
}

function MoveItem({
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

/** Pull an existing project (from Unassigned or another group) into this one. */
function AddProjectPopover({
  anchorEl,
  candidates,
  teamName,
  onPick,
  onClose,
}: {
  anchorEl: HTMLElement | null
  candidates: { project: Project; groupName: string | null }[]
  teamName: string
  onPick: (projectId: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = candidates.filter((c) =>
    c.project.name.toLowerCase().includes(q.trim().toLowerCase()),
  )
  return (
    <Popover anchorEl={anchorEl} onClose={onClose} width={264} align="left">
      <div className="shrink-0 border-b border-line p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects…"
          className="w-full rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-sunburst-500"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto fi-scroll py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-ink-3">
            No other projects to add.
          </p>
        ) : (
          filtered.map(({ project, groupName }) => (
            <button
              key={project.id}
              onClick={() => {
                onPick(project.id)
                onClose()
              }}
              title={`Move “${project.name}” into ${teamName}`}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {project.name}
              </span>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                {groupName ?? 'Unassigned'}
              </span>
            </button>
          ))
        )}
      </div>
    </Popover>
  )
}

export function TeamCard({
  team,
  members,
  projects,
  internsByProject,
  api,
  isAdmin,
}: {
  team: Team
  members: Intern[]
  projects: Project[]
  internsByProject: Map<string, Intern[]>
  api: UseTeams
  isAdmin: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: team.id,
    data: { type: 'team' },
    disabled: !isAdmin,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(team.name)
  const [addOpen, setAddOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setDraft(team.name), [team.name])

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
    if (trimmed && trimmed !== team.name) api.renameTeam(team.id, trimmed)
    else setDraft(team.name)
    setEditing(false)
  }

  // Projects available to pull in = every project not already in this group.
  const candidates = useMemo(
    () =>
      api.projects
        .filter((p) => p.team_id !== team.id)
        .map((p) => ({
          project: p,
          groupName: p.team_id
            ? (api.teams.find((t) => t.id === p.team_id)?.name ?? null)
            : null,
        }))
        .sort((a, b) => a.project.name.localeCompare(b.project.name)),
    [api.projects, api.teams, team.id],
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex flex-col rounded-xl border border-line bg-surface shadow-e1"
    >
      {/* Header */}
      <div className="rounded-t-xl border-b border-line bg-gradient-to-r from-surface-2 to-surface px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isAdmin ? (
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              aria-label="Drag to reorder group"
              title="Drag to reorder"
              className="cursor-grab rounded px-0.5 text-ink-3 transition hover:text-ink-2 active:cursor-grabbing"
            >
              ⠿
            </button>
          ) : null}
          {editing && isAdmin ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraft(team.name)
                  setEditing(false)
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-line-2 bg-surface px-2 py-0.5 text-sm font-bold text-ink outline-none focus:border-sunburst-500"
            />
          ) : (
            <h3
              className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink"
              title={team.name}
            >
              {team.name}
            </h3>
          )}

          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[10px] font-bold text-ink-2"
            title={`${members.length} ${members.length === 1 ? 'person' : 'people'} · ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
          >
            {members.length}
          </span>

          {isAdmin ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded px-1 text-ink-3 transition hover:text-ink-2"
                aria-label="Group options"
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-7 z-30 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-e2">
                  <button
                    onClick={() => {
                      setDraft(team.name)
                      setEditing(true)
                      setMenuOpen(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-surface-2"
                  >
                    Rename group
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      if (
                        window.confirm(
                          `Delete "${team.name}"? Its projects fall back to Unassigned — nothing is deleted.`,
                        )
                      )
                        api.deleteTeam(team.id)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-st-cancelled-fg transition hover:bg-st-cancelled-bg"
                  >
                    Delete group
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* People summary — derived from the projects' assigned interns */}
        <div className="mt-2 flex items-center gap-2">
          {members.length > 0 ? (
            <AvatarStack interns={members} max={8} />
          ) : (
            <span className="text-[11px] text-ink-3">No people yet</span>
          )}
        </div>
      </div>

      {/* Projects */}
      <div className="flex-1">
        {projects.length === 0 ? (
          <div className="m-2.5 flex items-center justify-center rounded-lg border border-dashed border-line-2 py-4 text-center text-[11px] text-ink-3">
            No projects in this group yet
          </div>
        ) : (
          projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              devs={internsByProject.get(p.id) ?? []}
              teams={api.teams}
              isAdmin={isAdmin}
              onMove={(teamId) => api.setProjectTeam(p.id, teamId)}
            />
          ))
        )}
      </div>

      {/* Add project */}
      {isAdmin ? (
        <div className="border-t border-line p-2">
          <button
            ref={addBtnRef}
            onClick={() => setAddOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line-2 py-1.5 text-[11px] font-semibold text-ink-3 transition hover:border-sunburst-400 hover:text-sunburst-600"
          >
            <span className="text-sm leading-none">＋</span> Add project
          </button>
          {addOpen ? (
            <AddProjectPopover
              anchorEl={addBtnRef.current}
              candidates={candidates}
              teamName={team.name}
              onPick={(projectId) => api.setProjectTeam(projectId, team.id)}
              onClose={() => setAddOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
