import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useAuth } from './useAuth'
import type {
  AttendanceRecord,
  Intern,
  Project,
  ProjectAssignment,
  StandupSession,
} from '../types'

/** Per-session state as seen by a member for their OWN attendance. */
export type MemberCellState =
  | 'upcoming'
  | 'open'
  | 'marked'
  | 'absent'
  | 'na'

/** Derived status of a cell in the admin matrix (a session × intern). */
export type CellStatus = 'present' | 'absent' | 'na'

interface AttendanceState {
  projects: Project[]
  sessions: StandupSession[]
  records: AttendanceRecord[]
  assignments: ProjectAssignment[]
  interns: Intern[]
}

const EMPTY: AttendanceState = {
  projects: [],
  sessions: [],
  records: [],
  assignments: [],
  interns: [],
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

export function useAttendance() {
  const toast = useToast()
  const { profile, session } = useAuth()
  const userId = session?.user?.id ?? null
  const myMoodleId = profile?.moodle_user_id ?? null

  const [state, setState] = useState<AttendanceState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { projects, sessions, records, assignments, interns } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // All queries are RLS-scoped: a member only receives rows for the
      // projects they're a member of; an admin receives everything.
      const [projectsR, sessionsR, recordsR, assignsR, internsR] =
        await Promise.all([
          supabase.from('projects').select('*').order('name'),
          supabase.from('standup_sessions').select('*').order('starts_at'),
          supabase.from('attendance_records').select('*'),
          supabase
            .from('project_interns')
            .select('project_id, intern_id, assigned_at'),
          supabase.from('interns').select('*').order('name'),
        ])
      const err =
        projectsR.error ||
        sessionsR.error ||
        recordsR.error ||
        assignsR.error ||
        internsR.error
      if (err) throw err
      setState({
        projects: (projectsR.data as Project[]) ?? [],
        sessions: (sessionsR.data as StandupSession[]) ?? [],
        records: (recordsR.data as AttendanceRecord[]) ?? [],
        assignments: (assignsR.data as ProjectAssignment[]) ?? [],
        interns: (internsR.data as Intern[]) ?? [],
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load attendance.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ---- Identity: the caller's own linked intern ---------------------------
  const myIntern = useMemo(
    () =>
      myMoodleId != null
        ? (interns.find((i) => i.moodle_user_id === myMoodleId) ?? null)
        : null,
    [interns, myMoodleId],
  )
  const isLinked = myMoodleId != null

  // ---- Indexes ------------------------------------------------------------
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )
  const internById = useMemo(
    () => new Map(interns.map((i) => [i.id, i])),
    [interns],
  )

  const sessionsByProject = useMemo(() => {
    const m = new Map<string, StandupSession[]>()
    for (const s of sessions) {
      const list = m.get(s.project_id) ?? []
      list.push(s)
      m.set(s.project_id, list)
    }
    for (const list of m.values())
      list.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))
    return m
  }, [sessions])

  /** session_id -> intern_id -> record */
  const recordBySessionIntern = useMemo(() => {
    const m = new Map<string, Map<string, AttendanceRecord>>()
    for (const r of records) {
      let inner = m.get(r.session_id)
      if (!inner) {
        inner = new Map()
        m.set(r.session_id, inner)
      }
      inner.set(r.intern_id, r)
    }
    return m
  }, [records])

  const assignmentsByProject = useMemo(() => {
    const m = new Map<string, ProjectAssignment[]>()
    for (const a of assignments) {
      const list = m.get(a.project_id) ?? []
      list.push(a)
      m.set(a.project_id, list)
    }
    return m
  }, [assignments])

  /** assigned_at for (project, intern), or null if not assigned. */
  const assignedAt = useCallback(
    (projectId: string, internId: string): string | null =>
      assignmentsByProject
        .get(projectId)
        ?.find((a) => a.intern_id === internId)?.assigned_at ?? null,
    [assignmentsByProject],
  )

  const hasRecord = useCallback(
    (sessionId: string, internId: string): boolean =>
      recordBySessionIntern.get(sessionId)?.has(internId) ?? false,
    [recordBySessionIntern],
  )

  const recordFor = useCallback(
    (sessionId: string, internId: string): AttendanceRecord | null =>
      recordBySessionIntern.get(sessionId)?.get(internId) ?? null,
    [recordBySessionIntern],
  )

  /** Derived cell status for the admin matrix (closed/absent/na/present). */
  const cellStatus = useCallback(
    (s: StandupSession, internId: string): CellStatus => {
      if (hasRecord(s.id, internId)) return 'present'
      const a = assignedAt(s.project_id, internId)
      if (a == null) return 'na'
      return new Date(a).getTime() <= new Date(s.starts_at).getTime()
        ? 'absent'
        : 'na'
    },
    [assignedAt, hasRecord],
  )

  /** Member's own state for a session (uses client clock for display only). */
  const memberState = useCallback(
    (s: StandupSession, now: number): MemberCellState => {
      const internId = myIntern?.id
      if (internId && hasRecord(s.id, internId)) return 'marked'
      const a = internId ? assignedAt(s.project_id, internId) : null
      if (a == null || new Date(a).getTime() > new Date(s.starts_at).getTime())
        return 'na'
      const start = new Date(s.starts_at).getTime()
      const end = new Date(s.ends_at).getTime()
      if (now < start) return 'upcoming'
      if (now >= start && now <= end) return 'open'
      return 'absent'
    },
    [assignedAt, hasRecord, myIntern],
  )

  // ---- Member action: self-mark present -----------------------------------
  const markAttended = useCallback(
    async (sessionId: string) => {
      if (!myIntern || !userId) {
        toast.error('Your account is not linked to a roster record yet.')
        return
      }
      // Optimistic: insert a provisional record.
      const optimistic: AttendanceRecord = {
        id: `optimistic-${sessionId}`,
        session_id: sessionId,
        intern_id: myIntern.id,
        status: 'present',
        marked_at: new Date().toISOString(),
        marked_by: userId,
      }
      const snapshot = records
      setState((s) => ({ ...s, records: [...s.records, optimistic] }))
      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .insert({
            session_id: sessionId,
            intern_id: myIntern.id,
            status: 'present',
            marked_by: userId,
          })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({
          ...s,
          records: s.records
            .filter((r) => r.id !== optimistic.id)
            .concat(data as AttendanceRecord),
        }))
      } catch (e) {
        setState((s) => ({ ...s, records: snapshot }))
        toast.error(
          `Could not mark attendance: ${msg(e)}. The session may have just closed — refresh to check.`,
        )
      }
    },
    [myIntern, userId, records, toast],
  )

  // ---- Admin action: amendment --------------------------------------------
  const amend = useCallback(
    async (
      sessionId: string,
      internId: string,
      newStatus: 'present' | 'absent',
      reason: string | null,
    ) => {
      try {
        const { error } = await supabase.rpc('admin_amend_attendance', {
          p_session_id: sessionId,
          p_intern_id: internId,
          p_new_status: newStatus,
          p_reason: reason,
        })
        if (error) throw error
        await loadAll()
        toast.success('Attendance corrected.')
      } catch (e) {
        toast.error(`Could not correct attendance: ${msg(e)}`)
      }
    },
    [loadAll, toast],
  )

  // ---- Admin action: CSV export -------------------------------------------
  const exportCsv = useCallback(
    async (projectId?: string) => {
      try {
        const { data, error } = await supabase.functions.invoke(
          'export-attendance',
          { body: projectId ? { projectId } : {} },
        )
        if (error) throw error
        const { filename, csv } = data as { filename: string; csv: string }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || 'attendance.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (e) {
        toast.error(`Could not export CSV: ${msg(e)}`)
      }
    },
    [toast],
  )

  return {
    // data
    projects,
    projectById,
    sessions,
    sessionsByProject,
    interns,
    internById,
    assignmentsByProject,
    // identity
    myIntern,
    isLinked,
    // status
    loading,
    loadError,
    reload: loadAll,
    // derivations
    assignedAt,
    hasRecord,
    recordFor,
    cellStatus,
    memberState,
    // actions
    markAttended,
    amend,
    exportCsv,
  }
}

export type UseAttendance = ReturnType<typeof useAttendance>
