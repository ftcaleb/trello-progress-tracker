import { useEffect, useMemo, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Intern, Role, Team, TeamMember, TeamProject } from '../types'
import { ROLE_LABELS } from '../types'
import { roleDotClass } from '../lib/roleStyles'
import { useInterns } from '../hooks/useInterns'
import type { UseTeams } from '../hooks/useTeams'
import { Popover } from './Popover'

const SHORT_ROLE: Record<Role, string> = {
  developer: 'Software Dev',
  designer: 'Designer',
  cybersecurity: 'Cyber Analyst',
}

/** A compact, draggable table row. Role is shown as a color dot + short label. */
function MemberRow({
  member,
  api,
  isAdmin,
}: {
  member: TeamMember
  api: UseTeams
  isAdmin: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: member.id,
      data: { type: 'member', teamId: member.team_id },
      disabled: !isAdmin,
    })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const stop = (e: React.PointerEvent) => e.stopPropagation()
  const inactive = !member.is_active

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isAdmin ? attributes : {})}
      {...(isAdmin ? listeners : {})}
      title={`${member.name} · ${ROLE_LABELS[member.role]}${inactive ? ' · inactive' : ''}`}
      className={`group/mem relative flex items-center gap-2 border-b border-navy-50 px-2.5 py-1.5 transition last:border-0 ${
        isAdmin ? 'cursor-grab hover:bg-navy-50 active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : ''} ${inactive ? 'bg-navy-50/40' : ''}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${roleDotClass[member.role]} ${
          inactive ? 'opacity-40' : ''
        }`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] font-medium ${
          inactive
            ? 'text-navy-400 line-through decoration-navy-300'
            : 'text-navy-800'
        }`}
      >
        {member.name}
      </span>
      <span
        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide text-navy-400 transition ${
          isAdmin ? 'group-hover/mem:opacity-0' : ''
        }`}
      >
        {SHORT_ROLE[member.role]}
      </span>

      {isAdmin ? (
        <span className="absolute inset-y-0 right-1.5 flex items-center gap-1 opacity-0 transition group-hover/mem:opacity-100">
          <button
            onPointerDown={stop}
            onClick={() => api.toggleMemberActive(member.id, inactive)}
            title={inactive ? 'Mark active' : 'Mark inactive'}
            className="rounded px-1 text-[11px] leading-none text-navy-400 transition hover:text-navy-700"
          >
            {inactive ? '○' : '◐'}
          </button>
          <button
            onPointerDown={stop}
            onClick={() => api.removeMember(member.id)}
            title="Remove from team"
            className="rounded px-1 text-[11px] leading-none text-navy-300 transition hover:text-red-600"
          >
            ✕
          </button>
        </span>
      ) : null}
    </div>
  )
}

function AddMemberPopover({
  anchorEl,
  teamMembers,
  onPick,
  onClose,
}: {
  anchorEl: HTMLElement | null
  teamMembers: TeamMember[]
  onPick: (intern: Intern) => void
  onClose: () => void
}) {
  const { interns } = useInterns()
  const [q, setQ] = useState('')

  const onTeamIds = new Set(
    teamMembers.map((m) => m.intern_id).filter((id): id is string => Boolean(id)),
  )
  const candidates = useMemo(
    () =>
      interns
        .filter((i) => !onTeamIds.has(i.id))
        .filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interns, q, teamMembers],
  )

  return (
    <Popover anchorEl={anchorEl} onClose={onClose} width={256} align="left">
      <div className="shrink-0 border-b border-navy-100 p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search roster…"
          className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-900 outline-none focus:border-sunburst-500"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto fi-scroll py-1">
        {candidates.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-navy-400">
            No matching roster records.
          </p>
        ) : (
          candidates.map((intern) => (
            <button
              key={intern.id}
              onClick={() => {
                onPick(intern)
                onClose()
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-navy-50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${roleDotClass[intern.role]}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-navy-800">
                {intern.name}
              </span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-navy-400">
                {SHORT_ROLE[intern.role]}
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
  api,
  isAdmin,
  activeType,
}: {
  team: Team
  members: TeamMember[]
  projects: TeamProject[]
  api: UseTeams
  isAdmin: boolean
  activeType: 'team' | 'member' | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
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
  const [addingProject, setAddingProject] = useState(false)
  const [projectDraft, setProjectDraft] = useState('')
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const addMemberBtnRef = useRef<HTMLButtonElement>(null)

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

  const commitProject = () => {
    if (projectDraft.trim()) {
      api.addProject(team.id, projectDraft)
      setProjectDraft('')
      setAddingProject(false)
    }
  }

  const isMemberDropTarget = isOver && activeType === 'member'
  const inactiveCount = members.filter((m) => !m.is_active).length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex flex-col rounded-xl border bg-white shadow-card transition ${
        isMemberDropTarget
          ? 'border-sunburst-400 ring-2 ring-sunburst-400/40'
          : 'border-navy-100'
      }`}
    >
      {/* Header */}
      <div className="rounded-t-xl border-b border-navy-100 bg-gradient-to-r from-navy-50 to-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isAdmin ? (
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              aria-label="Drag to reorder team"
              title="Drag to reorder"
              className="cursor-grab rounded px-0.5 text-navy-300 transition hover:text-navy-600 active:cursor-grabbing"
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
              className="min-w-0 flex-1 rounded-md border border-navy-200 bg-white px-2 py-0.5 text-sm font-bold text-navy-900 outline-none focus:border-sunburst-500"
            />
          ) : (
            <h3
              className="min-w-0 flex-1 truncate text-sm font-extrabold text-navy-900"
              title={team.name}
            >
              {team.name}
            </h3>
          )}

          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-100 px-1.5 text-[10px] font-bold text-navy-600"
            title={`${members.length} member${members.length === 1 ? '' : 's'}${
              inactiveCount ? ` · ${inactiveCount} inactive` : ''
            }`}
          >
            {members.length}
          </span>

          {isAdmin ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded px-1 text-navy-400 transition hover:text-navy-700"
                aria-label="Team options"
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-7 z-30 w-36 overflow-hidden rounded-lg border border-navy-100 bg-white py-1 shadow-pop">
                  <button
                    onClick={() => {
                      setDraft(team.name)
                      setEditing(true)
                      setMenuOpen(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-navy-700 transition hover:bg-navy-50"
                  >
                    Rename team
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      if (
                        window.confirm(
                          `Delete "${team.name}"? This removes the team and its member list.`,
                        )
                      )
                        api.deleteTeam(team.id)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    Delete team
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Project chips */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {projects.map((p) => (
            <span
              key={p.id}
              className="group/proj inline-flex items-center gap-1 rounded-full border border-maroon-100 bg-maroon-50 px-2 py-0.5 text-[10px] font-semibold text-maroon-700"
            >
              {p.name}
              {isAdmin ? (
                <button
                  onClick={() => api.removeProject(p.id)}
                  title="Remove project"
                  className="text-maroon-400 opacity-0 transition hover:text-maroon-700 group-hover/proj:opacity-100"
                >
                  ✕
                </button>
              ) : null}
            </span>
          ))}

          {isAdmin ? (
            addingProject ? (
              <input
                autoFocus
                value={projectDraft}
                onChange={(e) => setProjectDraft(e.target.value)}
                onBlur={commitProject}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitProject()
                  if (e.key === 'Escape') {
                    setProjectDraft('')
                    setAddingProject(false)
                  }
                }}
                placeholder="Project…"
                className="w-28 rounded-full border border-navy-200 bg-white px-2 py-0.5 text-[10px] text-navy-900 outline-none focus:border-sunburst-500"
              />
            ) : (
              <button
                onClick={() => setAddingProject(true)}
                className="rounded-full border border-dashed border-navy-200 px-2 py-0.5 text-[10px] font-semibold text-navy-400 transition hover:border-sunburst-400 hover:text-sunburst-600"
              >
                + Project
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Members (compact table) */}
      <div className="flex-1">
        {members.length === 0 ? (
          <div
            className={`m-2.5 flex items-center justify-center rounded-lg border border-dashed py-4 text-center text-[11px] transition ${
              isMemberDropTarget
                ? 'border-sunburst-400 text-sunburst-600'
                : 'border-navy-200 text-navy-400'
            }`}
          >
            {isMemberDropTarget ? 'Drop to add here' : 'No members yet'}
          </div>
        ) : (
          members.map((m) => (
            <MemberRow key={m.id} member={m} api={api} isAdmin={isAdmin} />
          ))
        )}
      </div>

      {/* Add member */}
      {isAdmin ? (
        <div className="border-t border-navy-100 p-2">
          <button
            ref={addMemberBtnRef}
            onClick={() => setAddMemberOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-navy-200 py-1.5 text-[11px] font-semibold text-navy-400 transition hover:border-sunburst-400 hover:text-sunburst-600"
          >
            <span className="text-sm leading-none">＋</span> Add member
          </button>
          {addMemberOpen ? (
            <AddMemberPopover
              anchorEl={addMemberBtnRef.current}
              teamMembers={members}
              onPick={(intern) => api.addMember(team.id, intern)}
              onClose={() => setAddMemberOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
