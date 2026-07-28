import { useEffect, useMemo, useState } from 'react'
import { useAttendance, type UseAttendance } from '../hooks/useAttendance'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/Modal'
import {
  CalendarIcon,
  DownloadIcon,
  LinkIcon,
  LockIcon,
  StarIcon,
} from '../components/icons'
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
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Standup{' '}
              <span className="bg-gradient-to-r from-sunburst-500 to-maroon-600 bg-clip-text text-transparent">
                Attendance
              </span>
            </h1>
            <p className="mt-1 text-sm text-ink-3">
              {isAdmin
                ? 'Attendance across every project. Click any cell to correct it.'
                : 'Tick in during your standup. Each session opens only for its scheduled hour.'}
            </p>
          </div>
          {isAdmin ? (
            <button
              onClick={() => void att.exportCsv()}
              className="inline-flex items-center gap-2 rounded-xl bg-rail px-4 py-2.5 text-sm font-semibold text-rail-ink shadow-e1 transition hover:opacity-90"
            >
              <DownloadIcon size={16} /> Export CSV
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
      <div className="mx-auto max-w-md rounded-2xl border border-st-pending bg-st-pending-bg p-8 text-center">
        <div className="mb-2 flex justify-center text-st-pending">
          <LinkIcon size={26} />
        </div>
        <h2 className="text-lg font-bold text-ink">
          Your account isn't linked yet
        </h2>
        <p className="mt-1 text-sm text-ink-3">
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
      <div className="rounded-2xl border border-dashed border-line-2 bg-surface py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sunburst-400 to-maroon-600">
          <CalendarIcon size={22} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-ink">
          No standups scheduled yet
        </h2>
        <p className="mt-1 text-sm text-ink-3">
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
          className="overflow-hidden rounded-2xl border border-line bg-surface shadow-e1"
        >
          <div className="border-b border-line bg-gradient-to-r from-surface-2 to-surface px-4 py-3">
            <h3 className="text-sm font-extrabold text-ink">{p.name}</h3>
          </div>
          <div className="divide-y divide-line">
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
          <span className="text-[13px] font-semibold text-ink">
            {day(session.starts_at)}
          </span>
          <span className="text-[11px] text-ink-3">
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
            className="rounded-lg bg-gradient-to-r from-sunburst-500 to-maroon-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-e1 transition hover:brightness-110"
          >
            ✓ I attended
          </button>
        ) : st === 'marked' ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-st-approved-bg px-2.5 py-1.5 text-xs font-semibold text-st-approved-fg">
            ✓ Marked{rec ? ` · ${time(rec.marked_at)}` : ''}
          </span>
        ) : st === 'upcoming' ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-ink-3">
            <LockIcon size={12} /> Opens {day(session.starts_at)}{' '}
            {time(session.starts_at)}
          </span>
        ) : st === 'na' ? (
          <span className="inline-flex items-center rounded-lg border border-dashed border-line-2 px-2.5 py-1.5 text-xs font-medium text-ink-3">
            N/A
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-ink-3">
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
        <div className="rounded-xl border border-dashed border-line-2 bg-surface p-4 text-sm text-ink-3">
          <span className="font-semibold text-ink-3">
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

  // Derived attendance rate for this project's register (present / marked).
  const rate = useMemo(() => {
    let present = 0
    let absent = 0
    for (const intern of roster) {
      for (const s of sessions) {
        const st = att.cellStatus(s, intern.id)
        if (st === 'present') present++
        else if (st === 'absent') absent++
      }
    }
    const marked = present + absent
    return {
      present,
      marked,
      pct: marked > 0 ? Math.round((present / marked) * 100) : null,
    }
  }, [roster, sessions, att])

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-surface-2 to-surface px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-extrabold text-ink">{project.name}</h3>
          <span className="hidden text-[11px] text-ink-3 sm:inline">
            <span className="font-bold text-st-approved-fg">✓</span> present
            {'  ·  '}
            <span className="font-bold text-st-cancelled-fg">✕</span> absent
            {'  ·  '}
            <span className="font-bold">–</span> n/a
          </span>
        </div>
        <div className="flex items-center gap-3">
          {rate.pct !== null ? (
            <div
              className="flex items-center gap-2"
              title={`${rate.present}/${rate.marked} present across marked sessions`}
            >
              <span className="font-display text-base font-bold tabular-nums text-ink">
                {rate.pct}%
              </span>
              <div
                className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3"
                role="meter"
                aria-valuenow={rate.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Attendance rate"
              >
                <div
                  className="h-full rounded-full bg-viz-series transition-[width] duration-500"
                  style={{ width: `${rate.pct}%` }}
                />
              </div>
            </div>
          ) : null}
          <button
            onClick={() => void att.exportCsv(project.id)}
            className="rounded-lg border border-line-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition hover:border-sunburst-400 hover:text-sunburst-600"
          >
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto fi-scroll">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[9rem] bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                Intern
              </th>
              {sessions.map((s) => (
                <th
                  key={s.id}
                  className={`px-2 py-2 text-center text-[10px] font-semibold ${
                    s.is_initial_meet ? 'bg-accent-wash text-accent' : 'text-ink-3'
                  }`}
                  title={
                    s.is_initial_meet
                      ? `Project Initial Meet · ${day(s.starts_at)} ${time(s.starts_at)}`
                      : `${day(s.starts_at)} ${time(s.starts_at)}`
                  }
                >
                  <div>{day(s.starts_at).split(' ').slice(1).join(' ')}</div>
                  {s.is_initial_meet ? (
                    <div className="inline-flex items-center gap-0.5">
                      <StarIcon size={9} /> Meet
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr>
                <td
                  colSpan={sessions.length + 1}
                  className="px-3 py-4 text-center text-xs text-ink-3"
                >
                  No interns assigned to this project.
                </td>
              </tr>
            ) : (
              roster.map((intern) => (
                <tr key={intern.id} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                    <div className="text-[13px] font-medium text-ink">
                      {intern.name}
                    </div>
                    <div className="text-[10px] text-ink-3">
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
  if (status === 'present') return 'bg-st-approved-bg text-st-approved-fg'
  if (status === 'absent') return 'bg-st-cancelled-bg text-st-cancelled-fg'
  return 'bg-surface-3 text-ink-3'
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
        <div className="text-sm text-ink-2">
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
                    ? 'border-st-approved bg-st-approved-bg text-st-approved-fg'
                    : 'border-st-cancelled bg-st-cancelled-bg text-st-cancelled-fg'
                  : 'border-line-2 text-ink-3 hover:bg-surface-2'
              }`}
            >
              Mark {opt}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. joined by phone; system was down…"
            className="w-full resize-none rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-sunburst-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-3 transition hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl bg-rail px-4 py-2 text-sm font-semibold text-rail-ink transition hover:opacity-90 disabled:opacity-50"
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
    <div className="flex h-full items-center justify-center p-8 text-ink-3">
      {spin ? (
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line-2 border-t-sunburst-500" />
      ) : (
        <div className="max-w-md rounded-2xl border border-st-pending bg-st-pending-bg p-6 text-center text-sm text-ink-2">
          {children}
        </div>
      )}
    </div>
  )
}
