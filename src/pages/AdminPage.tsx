import { useMemo, useState } from 'react'
import { useAdmin } from '../hooks/useAdmin'
import { useAuth } from '../hooks/useAuth'
import { ROLE_LABELS, ROLE_ORDER } from '../types'
import type { Profile, Project, Role } from '../types'
import { Avatar, AvatarStack } from '../components/Avatar'

type Tab = 'people' | 'teams'

export function AdminPage() {
  const admin = useAdmin()
  const { profile: me } = useAuth()
  const [tab, setTab] = useState<Tab>('people')

  return (
    <div className="h-full overflow-y-auto fi-scroll">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-navy-900">
            <span aria-hidden="true">🛡️</span> Admin Console
          </h1>
          <p className="mt-1 text-sm text-navy-400">
            Manage who has access, connect people to the roster, and assign them
            to projects.
          </p>
        </div>

        <div className="mb-5 inline-flex rounded-xl border border-navy-100 bg-white p-1 shadow-card">
          {(['people', 'teams'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
                tab === t
                  ? 'bg-navy-900 text-white'
                  : 'text-navy-500 hover:bg-navy-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {admin.loading ? (
          <div className="flex h-40 items-center justify-center text-navy-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-navy-200 border-t-sunburst-500" />
          </div>
        ) : admin.loadError ? (
          <div className="rounded-xl border border-sunburst-200 bg-sunburst-50/50 p-6 text-center text-sm text-navy-600">
            {admin.loadError}
            <button
              onClick={() => admin.reload()}
              className="ml-3 rounded-lg bg-sunburst-500 px-3 py-1 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : tab === 'people' ? (
          <PeopleTab admin={admin} myId={me?.id ?? null} />
        ) : (
          <TeamsTab admin={admin} />
        )}
      </div>
    </div>
  )
}

/* ----------------------------- People ------------------------------------ */

function PeopleTab({
  admin,
  myId,
}: {
  admin: ReturnType<typeof useAdmin>
  myId: string | null
}) {
  const { profiles } = admin
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-card">
      <div className="hidden grid-cols-12 gap-2 border-b border-navy-100 bg-navy-50/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400 md:grid">
        <div className="col-span-4">Person</div>
        <div className="col-span-2">Role</div>
        <div className="col-span-2">Access</div>
        <div className="col-span-1">Last login</div>
        <div className="col-span-3">Roster link</div>
      </div>
      {profiles.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-navy-400">
          No one has signed in yet.
        </p>
      ) : (
        profiles.map((p) => (
          <PersonRow key={p.id} admin={admin} profile={p} isSelf={p.id === myId} />
        ))
      )}
    </div>
  )
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function PersonRow({
  admin,
  profile,
  isSelf,
}: {
  admin: ReturnType<typeof useAdmin>
  profile: Profile
  isSelf: boolean
}) {
  const linked = admin.linkedInternForProfile(profile)
  const isAdmin = profile.app_role === 'admin'
  const displayName = profile.full_name?.trim() || profile.moodle_username || '—'

  return (
    <div className="border-b border-navy-50 p-4 last:border-0 md:grid md:grid-cols-12 md:items-center md:gap-2 md:px-4 md:py-3">
      {/* Person */}
      <div className="min-w-0 md:col-span-4">
        <div className="truncate text-sm font-semibold text-navy-900">
          {displayName}
          {isSelf ? (
            <span className="ml-1.5 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
              you
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-navy-400">
          {profile.moodle_username
            ? `@${profile.moodle_username}`
            : 'email account'}
        </div>
      </div>

      {/* Role */}
      <div className="mt-3 flex items-center md:col-span-2 md:mt-0">
        <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400 md:hidden">
          Role
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isAdmin
              ? 'bg-maroon-600 text-white'
              : 'bg-navy-100 text-navy-600'
          }`}
        >
          {isAdmin ? 'Admin' : 'Member'}
        </span>
        <button
          disabled={isSelf}
          onClick={() =>
            admin.setRole(profile.id, isAdmin ? 'member' : 'admin')
          }
          title={isSelf ? "You can't change your own role" : ''}
          className="ml-2 text-[11px] font-medium text-navy-400 underline-offset-2 transition hover:text-maroon-600 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
        >
          {isAdmin ? 'demote' : 'make admin'}
        </button>
      </div>

      {/* Access */}
      <div className="mt-2 flex items-center md:col-span-2 md:mt-0">
        <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400 md:hidden">
          Access
        </span>
        <button
          disabled={isSelf}
          onClick={() => admin.setActive(profile.id, !profile.is_active)}
          title={isSelf ? "You can't disable yourself" : ''}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            profile.is_active
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-navy-100 text-navy-500 hover:bg-navy-200'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              profile.is_active ? 'bg-emerald-500' : 'bg-navy-400'
            }`}
          />
          {profile.is_active ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* Last login */}
      <div className="mt-2 flex items-center text-xs text-navy-400 md:col-span-1 md:mt-0">
        <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400 md:hidden">
          Last login
        </span>
        {relativeTime(profile.last_login_at)}
      </div>

      {/* Roster link */}
      <div className="mt-3 md:col-span-3 md:mt-0">
        {linked ? (
          <div className="flex items-center gap-2">
            <Avatar intern={linked} />
            <span className="min-w-0 flex-1 truncate text-xs text-navy-600">
              {linked.name}
            </span>
            <button
              onClick={() => admin.unlinkProfile(profile)}
              className="text-[11px] font-medium text-navy-400 transition hover:text-sunburst-600"
            >
              unlink
            </button>
          </div>
        ) : (
          <LinkControl admin={admin} profile={profile} />
        )}
      </div>
    </div>
  )
}

function LinkControl({
  admin,
  profile,
}: {
  admin: ReturnType<typeof useAdmin>
  profile: Profile
}) {
  const [creating, setCreating] = useState(false)
  const [role, setRole] = useState<Role>('developer')

  // Unlinked roster records, best name-match first.
  const candidates = useMemo(() => {
    const name = (profile.full_name ?? '').toLowerCase()
    return admin.interns
      .filter((i) => i.moodle_user_id == null)
      .sort((a, b) => {
        const am = name && a.name.toLowerCase().includes(name) ? 0 : 1
        const bm = name && b.name.toLowerCase().includes(name) ? 0 : 1
        return am - bm || a.name.localeCompare(b.name)
      })
  }, [admin.interns, profile.full_name])

  if (profile.moodle_user_id == null) {
    return <span className="text-[11px] text-navy-300">— (no Moodle id)</span>
  }

  if (creating) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs text-navy-700 outline-none focus:border-sunburst-500"
        >
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            void admin.createInternForProfile(profile, role)
            setCreating(false)
          }}
          className="rounded-lg bg-maroon-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-maroon-700"
        >
          Create
        </button>
        <button
          onClick={() => setCreating(false)}
          className="text-[11px] text-navy-400 hover:text-navy-700"
        >
          cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) void admin.linkProfileToIntern(profile, e.target.value)
        }}
        className="min-w-0 flex-1 rounded-lg border border-navy-200 bg-white px-2 py-1 text-xs text-navy-700 outline-none focus:border-sunburst-500"
      >
        <option value="" disabled>
          Link to roster…
        </option>
        {candidates.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} · {ROLE_LABELS[i.role]}
          </option>
        ))}
      </select>
      <button
        onClick={() => setCreating(true)}
        className="whitespace-nowrap text-[11px] font-medium text-navy-400 transition hover:text-maroon-600"
      >
        + new
      </button>
    </div>
  )
}

/* ----------------------------- Teams ------------------------------------- */

function TeamsTab({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  return (
    <div className="space-y-4">
      {admin.projects.map((project) => (
        <ProjectTeam key={project.id} admin={admin} project={project} />
      ))}
    </div>
  )
}

function ProjectTeam({
  admin,
  project,
}: {
  admin: ReturnType<typeof useAdmin>
  project: Project
}) {
  const [open, setOpen] = useState(false)
  const assigned = admin.internsByProject.get(project.id) ?? []
  const assignedIds = new Set(assigned.map((i) => i.id))

  return (
    <div className="rounded-xl border border-navy-100 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-navy-900">
            {project.name}
          </div>
          <div className="text-xs text-navy-400">
            {assigned.length} assigned
          </div>
        </div>
        <div className="flex items-center gap-3">
          {assigned.length > 0 ? <AvatarStack interns={assigned} max={6} /> : null}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-600 transition hover:border-sunburst-400 hover:text-sunburst-600"
          >
            {open ? 'Done' : 'Manage team'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="max-h-72 space-y-1 overflow-y-auto fi-scroll border-t border-navy-100 p-3">
          {admin.interns.length === 0 ? (
            <p className="py-4 text-center text-xs text-navy-400">
              No roster records yet.
            </p>
          ) : (
            admin.interns.map((intern) => {
              const checked = assignedIds.has(intern.id)
              return (
                <label
                  key={intern.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-navy-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      void admin.setAssignment(
                        project.id,
                        intern.id,
                        e.target.checked,
                      )
                    }
                    className="h-4 w-4 rounded border-navy-300 text-sunburst-500 focus:ring-sunburst-500/30"
                  />
                  <Avatar intern={intern} />
                  <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                    {intern.name}
                  </span>
                  <span className="text-[11px] text-navy-400">
                    {ROLE_LABELS[intern.role]}
                    {intern.moodle_user_id != null ? ' · linked' : ''}
                  </span>
                </label>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
