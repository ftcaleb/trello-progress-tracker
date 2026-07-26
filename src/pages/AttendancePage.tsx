import { useEffect, useMemo, useState } from 'react'
import { useAttendance, type UseAttendance } from '../hooks/useAttendance'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/Modal'
import { ROLE_LABELS, type Intern, type Project, type StandupSession } from '../types'

const SAST = 'Africa/Johannesburg'
const fmtDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: SAST,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const fmtTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: SAST,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const day = (iso: string) => fmtDay.format(new Date(iso))
const time = (iso: string) => fmtTime.format(new Date(iso))

export function AttendancePage() {
  const att = useAttendance()
  const { isAdmin } = useAuth()

  if (att.loading) return <Centered spin />
  if (att.loadError)
    return <Centered>{att.loadError}</Centered>

  return (
    <div className="h-full overflow-y-auto fi-scroll">
      <div className="mx-auto max-w-[100rem] px-5 py-6 sm:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
              Standup{' '}
              <span className="bg-gradient-to-r from-sunburst-500 to-maroon-600 bg-clip-text text-transparent">
                Attendance
              </span>
            </h1>
            <p className="mt-1 text-sm text-navy-400">
              {isAdmin
                ? 'Attendance across every project. Click any cell to correct it.'
                : 'Tick in during your standup. Each session opens only for its scheduled hour.'}
            </p>
          </div>
          {isAdmin ? (
            <button
              onClick={() => void att.exportCsv()}
              className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800"
            >
              <span aria-hidden="true">⬇</span> Export CSV
            </button>
          ) : null}
        </div>

        {isAdmin ? <AdminView att={att} /> : <MemberView att={att} />}
      </div>
    </div>
  )
}

/* ------------------------------- Member ---------------------------------- */

function MemberView({ att }: { att: UseAttendance }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!att.isLinked) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-sunburst-200 bg-sunburst-50/50 p-8 text-center">
        <div className="mb-2 text-2xl">🔗</div>
        <h2 className="text-lg font-bold text-navy-900">
          Your account isn't linked yet
        </h2>
        <p className="mt-1 text-sm text-navy-500">
          Ask an administrator to link your account to your roster record. Once
          linked, your project standups will appear here.
        </p>
      </div>
    )
  }

  const projects = att.projects.filter(
    (p) => (att.sessionsByProject.get(p.id) ?? []).length > 0,
  )

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-navy-200 bg-white py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600 text-xl">
          🗓️
        </div>
        <h2 className="text-lg font-bold text-navy-900">
          No standups scheduled yet
        </h2>
        <p className="mt-1 text-sm text-navy-400">
          When your project's standup schedule is set, your sessions show up
          here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {projects.map((p) => (
        <div
          key={p.id}
          className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card"
        >
          <div className="border-b border-navy-100 bg-gradient-to-r from-navy-50 to-white px-4 py-3">
            <h3 className="text-sm font-extrabold text-navy-900">{p.name}</h3>
          </div>
          <div className="divide-y divide-navy-50">
            {(att.sessionsByProject.get(p.id) ?? []).map((s) => (
              <MemberSessionRow key={s.id} session={s} att={att} now={now} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MemberSessionRow({
  session,
  att,
  now,
}: {
  session: StandupSession
  att: UseAttendance
  now: number
}) {
  const st = att.memberState(session, now)
  const rec =
    att.myIntern && st === 'marked'
      ? att.recordFor(session.id, att.myIntern.id)
      : null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-navy-800">
            {day(session.starts_at)}
          </span>
          <span className="text-[11px] text-navy-400">
            {time(session.starts_at)}–{time(session.ends_at)}
          </span>
          {session.is_initial_meet ? (
            <span className="rounded-full bg-gradient-to-r from-sunburst-500 to-maroon-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Initial Meet
            </span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0">
        {st === 'open' ? (
          <button
            onClick={() => void att.markAttended(session.id)}
            className="rounded-lg bg-gradient-to-r from-sunburst-500 to-maroon-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
          >
            ✓ I attended
          </button>
        ) : st === 'marked' ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
            ✓ Marked{rec ? ` · ${time(rec.marked_at)}` : ''}
          </span>
        ) : st === 'upcoming' ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1.5 text-xs font-medium text-navy-400">
            🔒 Opens {day(session.starts_at)} {time(session.starts_at)}
          </span>
        ) : st === 'na' ? (
          <span className="inline-flex items-center rounded-lg border border-dashed border-navy-200 px-2.5 py-1.5 text-xs font-medium text-navy-300">
            N/A
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1.5 text-xs font-medium text-navy-400">
            Missed
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Admin ----------------------------------- */

interface AmendTarget {
  session: StandupSession
  intern: Intern
  current: 'present' | 'absent' | 'na'
}

function AdminView({ att }: { att: UseAttendance }) {
  const [target, setTarget] = useState<AmendTarget | null>(null)

  const withSessions = att.projects.filter(
    (p) => (att.sessionsByProject.get(p.id) ?? []).length > 0,
  )
  const withoutSessions = att.projects.filter(
    (p) => (att.sessionsByProject.get(p.id) ?? []).length === 0,
  )

  return (
    <div className="space-y-6">
      {withSessions.map((p) => (
        <ProjectMatrix key={p.id} project={p} att={att} onPick={setTarget} />
      ))}

      {withoutSessions.length > 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-white p-4 text-sm text-navy-400">
          <span className="font-semibold text-navy-500">
            No schedule set yet:
          </span>{' '}
          {withoutSessions.map((p) => p.name).join(', ')} — set each project's
          Initial Meet date in its Settings to generate its register.
        </div>
      ) : null}

      {target ? (
        <AmendModal target={target} att={att} onClose={() => setTarget(null)} />
      ) : null}
    </div>
  )
}

function ProjectMatrix({
  project,
  att,
  onPick,
}: {
  project: Project
  att: UseAttendance
  onPick: (t: AmendTarget) => void
}) {
  const sessions = att.sessionsByProject.get(project.id) ?? []
  const roster = useMemo(() => {
    const ids = (att.assignmentsByProject.get(project.id) ?? []).map(
      (a) => a.intern_id,
    )
    return ids
      .map((id) => att.internById.get(id))
      .filter((i): i is Intern => Boolean(i))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [att, project.id])

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-navy-100 bg-gradient-to-r from-navy-50 to-white px-4 py-3">
        <h3 className="text-sm font-extrabold text-navy-900">{project.name}</h3>
        <button
          onClick={() => void att.exportCsv(project.id)}
          className="rounded-lg border border-navy-200 px-2.5 py-1 text-[11px] font-semibold text-navy-600 transition hover:border-sunburst-400 hover:text-sunburst-600"
        >
          Export
        </button>
      </div>

      <div className="overflow-x-auto fi-scroll">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                Intern
              </th>
              {sessions.map((s) => (
                <th
                  key={s.id}
                  className={`px-2 py-2 text-center text-[10px] font-semibold ${
                    s.is_initial_meet ? 'bg-sunburst-50 text-maroon-700' : 'text-navy-400'
                  }`}
                  title={
                    s.is_initial_meet
                      ? `Project Initial Meet · ${day(s.starts_at)} ${time(s.starts_at)}`
                      : `${day(s.starts_at)} ${time(s.starts_at)}`
                  }
                >
                  <div>{day(s.starts_at).split(' ').slice(1).join(' ')}</div>
                  {s.is_initial_meet ? <div>★ Meet</div> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr>
                <td
                  colSpan={sessions.length + 1}
                  className="px-3 py-4 text-center text-xs text-navy-400"
                >
                  No interns assigned to this project.
                </td>
              </tr>
            ) : (
              roster.map((intern) => (
                <tr key={intern.id} className="border-t border-navy-50">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                    <div className="text-[13px] font-medium text-navy-800">
                      {intern.name}
                    </div>
                    <div className="text-[10px] text-navy-400">
                      {ROLE_LABELS[intern.role]}
                      {intern.moodle_user_id == null ? ' · unlinked' : ''}
                    </div>
                  </td>
                  {sessions.map((s) => {
                    const status = att.cellStatus(s, intern.id)
                    return (
                      <td key={s.id} className="px-2 py-1.5 text-center">
                        <button
                          onClick={() =>
                            onPick({ session: s, intern, current: status })
                          }
                          title={`${intern.name} · ${day(s.starts_at)} — ${status} (click to correct)`}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold transition hover:ring-2 hover:ring-sunburst-400/50 ${cellClasses(status)}`}
                        >
                          {status === 'present' ? '✓' : status === 'absent' ? '✕' : '–'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function cellClasses(status: 'present' | 'absent' | 'na'): string {
  if (status === 'present') return 'bg-emerald-50 text-emerald-700'
  if (status === 'absent') return 'bg-red-50 text-red-600'
  return 'bg-navy-50 text-navy-300'
}

function AmendModal({
  target,
  att,
  onClose,
}: {
  target: AmendTarget
  att: UseAttendance
  onClose: () => void
}) {
  const [next, setNext] = useState<'present' | 'absent'>(
    target.current === 'present' ? 'absent' : 'present',
  )
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await att.amend(target.session.id, target.intern.id, next, reason.trim() || null)
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Correct attendance"
      subtitle={`${target.intern.name} · ${day(target.session.starts_at)} ${time(target.session.starts_at)}${target.session.is_initial_meet ? ' · Project Initial Meet' : ''}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="text-sm text-navy-600">
          Current status:{' '}
          <span className="font-semibold">
            {target.current === 'present'
              ? 'Present'
              : target.current === 'absent'
                ? 'Absent'
                : 'N/A (not yet assigned)'}
          </span>
        </div>

        <div className="flex gap-2">
          {(['present', 'absent'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setNext(opt)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition ${
                next === opt
                  ? opt === 'present'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-red-300 bg-red-50 text-red-600'
                  : 'border-navy-200 text-navy-500 hover:bg-navy-50'
              }`}
            >
              Mark {opt}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-400">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. joined by phone; system was down…"
            className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none focus:border-sunburst-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-navy-500 transition hover:bg-navy-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save correction'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------ shared ----------------------------------- */

function Centered({
  children,
  spin,
}: {
  children?: React.ReactNode
  spin?: boolean
}) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-navy-400">
      {spin ? (
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-navy-200 border-t-sunburst-500" />
      ) : (
        <div className="max-w-md rounded-2xl border border-sunburst-200 bg-sunburst-50/50 p-6 text-center text-sm text-navy-600">
          {children}
        </div>
      )}
    </div>
  )
}
