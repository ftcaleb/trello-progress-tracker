import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useInterns } from './useInterns'
import type {
  Comment,
  Intern,
  Phase,
  PhaseReport,
  Project,
  PublicProfile,
  Task,
  TaskStatus,
} from '../types'

interface BoardState {
  project: Project | null
  phases: Phase[]
  tasks: Task[]
  comments: Comment[]
  reports: PhaseReport[]
  assignedInternIds: string[]
  authors: Record<string, PublicProfile>
}

const EMPTY: BoardState = {
  project: null,
  phases: [],
  tasks: [],
  comments: [],
  reports: [],
  assignedInternIds: [],
  authors: {},
}

function nowIso(): string {
  return new Date().toISOString()
}

export function useProjectBoard(projectId: string) {
  const toast = useToast()
  const { interns } = useInterns()
  const [state, setState] = useState<BoardState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { project, phases, tasks, comments, reports, assignedInternIds, authors } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [projectR, phasesR, tasksR, assignsR, reportsR] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase
          .from('phases')
          .select('*')
          .eq('project_id', projectId)
          .order('position'),
        supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('position'),
        supabase
          .from('project_interns')
          .select('intern_id')
          .eq('project_id', projectId),
        supabase.from('phase_reports').select('*').eq('project_id', projectId),
      ])
      if (projectR.error) throw projectR.error
      if (phasesR.error) throw phasesR.error
      if (tasksR.error) throw tasksR.error
      if (assignsR.error) throw assignsR.error
      if (reportsR.error) throw reportsR.error

      const loadedTasks = (tasksR.data as Task[]) ?? []
      const taskIds = loadedTasks.map((t) => t.id)

      let loadedComments: Comment[] = []
      let loadedAuthors: Record<string, PublicProfile> = {}
      if (taskIds.length > 0) {
        const commentsR = await supabase
          .from('comments')
          .select('*')
          .in('task_id', taskIds)
          .order('created_at', { ascending: true })
        if (commentsR.error) throw commentsR.error
        loadedComments = (commentsR.data as Comment[]) ?? []

        const createdByIds = Array.from(
          new Set(loadedComments.map((c) => c.created_by).filter((id): id is string => Boolean(id)))
        )
        if (createdByIds.length > 0) {
          const profilesR = await supabase
            .from('public_profiles')
            .select('id, full_name, moodle_username')
            .in('id', createdByIds)
          if (!profilesR.error && profilesR.data) {
            loadedAuthors = profilesR.data.reduce<Record<string, PublicProfile>>((acc, p) => {
              acc[p.id] = p
              return acc
            }, {})
          }
        }
      }

      setState({
        project: projectR.data as Project,
        phases: (phasesR.data as Phase[]) ?? [],
        tasks: loadedTasks,
        comments: loadedComments,
        reports: (reportsR.data as PhaseReport[]) ?? [],
        assignedInternIds: (
          (assignsR.data as { intern_id: string }[]) ?? []
        ).map((r) => r.intern_id),
        authors: loadedAuthors,
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load project.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ---- Derived ------------------------------------------------------------
  const orderedPhases = useMemo(
    () => [...phases].sort((a, b) => a.position - b.position),
    [phases],
  )

  const tasksByPhase = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const ph of phases) map.set(ph.id, [])
    for (const t of tasks) {
      const list = map.get(t.phase_id)
      if (list) list.push(t)
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position)
    return map
  }, [tasks, phases])

  const commentCountByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of comments)
      map.set(c.task_id, (map.get(c.task_id) ?? 0) + 1)
    return map
  }, [comments])

  const assignedInterns = useMemo<Intern[]>(() => {
    const ids = new Set(assignedInternIds)
    return interns.filter((i) => ids.has(i.id))
  }, [interns, assignedInternIds])

  const reportsByPhase = useMemo(() => {
    const map = new Map<string, PhaseReport>()
    for (const r of reports) map.set(r.phase_id, r)
    return map
  }, [reports])

  /** A phase is "cleared" when it has at least one task and all are approved. */
  const isPhaseCleared = useCallback(
    (phaseId: string) => {
      const list = tasksByPhase.get(phaseId) ?? []
      return list.length > 0 && list.every((t) => t.status === 'approved')
    },
    [tasksByPhase],
  )

  // ---- Generic task persistence (diff phase_id/position/status) -----------
  const commitTasks = useCallback(
    async (next: Task[], failMessage: string) => {
      const snapshot = tasks
      const before = new Map(snapshot.map((t) => [t.id, t]))
      const changed = next.filter((t) => {
        const prev = before.get(t.id)
        return (
          prev &&
          (prev.phase_id !== t.phase_id ||
            prev.position !== t.position ||
            prev.status !== t.status)
        )
      })
      setState((s) => ({ ...s, tasks: next }))
      if (changed.length === 0) return
      try {
        const results = await Promise.all(
          changed.map((t) =>
            supabase
              .from('tasks')
              .update({
                phase_id: t.phase_id,
                position: t.position,
                status: t.status,
              })
              .eq('id', t.id),
          ),
        )
        const failed = results.find((r) => r.error)
        if (failed?.error) throw failed.error
      } catch (e) {
        setState((s) => ({ ...s, tasks: snapshot }))
        toast.error(
          `${failMessage}: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [tasks, toast],
  )

  // ---- Task mutations -----------------------------------------------------
  const addTask = useCallback(
    async (phaseId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const inPhase = tasks.filter((t) => t.phase_id === phaseId)
      const position = inPhase.reduce((m, t) => Math.max(m, t.position + 1), 0)
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            project_id: projectId,
            phase_id: phaseId,
            title: trimmed,
            status: 'in_progress',
            position,
          })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({ ...s, tasks: [...s.tasks, data as Task] }))
      } catch (e) {
        toast.error(
          `Could not add task: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [tasks, projectId, toast],
  )

  const updateTaskTitle = useCallback(
    async (taskId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const snapshot = tasks
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, title: trimmed } : t,
        ),
      }))
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ title: trimmed })
          .eq('id', taskId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, tasks: snapshot }))
        toast.error(
          `Could not rename task: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [tasks, toast],
  )

  const setTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      const snapshot = tasks
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
      }))
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status })
          .eq('id', taskId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, tasks: snapshot }))
        toast.error(
          `Could not update status: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [tasks, toast],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      const snapshot = state
      setState((s) => ({
        ...s,
        tasks: s.tasks.filter((t) => t.id !== taskId),
        comments: s.comments.filter((c) => c.task_id !== taskId),
      }))
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId)
        if (error) throw error
      } catch (e) {
        setState(snapshot)
        toast.error(
          `Could not delete task: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [state, toast],
  )

  /** Move all tasks of a phase to the next phase; reset their status. */
  const advancePhase = useCallback(
    async (phaseId: string) => {
      const idx = orderedPhases.findIndex((p) => p.id === phaseId)
      if (idx < 0 || idx >= orderedPhases.length - 1) return
      const target = orderedPhases[idx + 1]
      const moving = (tasksByPhase.get(phaseId) ?? []).slice()
      if (moving.length === 0) return

      let cursor = (tasksByPhase.get(target.id) ?? []).reduce(
        (m, t) => Math.max(m, t.position + 1),
        0,
      )
      const movingIds = new Set(moving.map((t) => t.id))
      const next = tasks.map((t) => {
        if (!movingIds.has(t.id)) return t
        const order = moving.findIndex((m) => m.id === t.id)
        return {
          ...t,
          phase_id: target.id,
          position: cursor + order,
          status: 'in_progress' as TaskStatus,
        }
      })
      cursor += moving.length
      await commitTasks(next, 'Could not advance phase')
      toast.success(
        `Advanced ${moving.length} task${moving.length === 1 ? '' : 's'} to ${target.name}.`,
      )
    },
    [orderedPhases, tasksByPhase, tasks, commitTasks, toast],
  )

  // ---- Phase mutations ----------------------------------------------------
  const addPhase = useCallback(
    async (rawName?: string) => {
      const maxWeek = phases.reduce((m, p) => Math.max(m, p.week_number), 0)
      const maxPos = phases.reduce((m, p) => Math.max(m, p.position), 0)
      const name =
        (rawName ?? `Phase ${phases.length + 1}`).trim() ||
        `Phase ${phases.length + 1}`
      try {
        const { data, error } = await supabase
          .from('phases')
          .insert({
            project_id: projectId,
            name,
            week_number: maxWeek + 1,
            position: maxPos + 1,
          })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({ ...s, phases: [...s.phases, data as Phase] }))
      } catch (e) {
        toast.error(
          `Could not add phase: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [phases, projectId, toast],
  )

  const renamePhase = useCallback(
    async (phaseId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const snapshot = phases
      setState((s) => ({
        ...s,
        phases: s.phases.map((p) =>
          p.id === phaseId ? { ...p, name: trimmed } : p,
        ),
      }))
      try {
        const { error } = await supabase
          .from('phases')
          .update({ name: trimmed })
          .eq('id', phaseId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, phases: snapshot }))
        toast.error(
          `Could not rename phase: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [phases, toast],
  )

  const deletePhase = useCallback(
    async (phaseId: string) => {
      const ordered = [...phases].sort((a, b) => a.position - b.position)
      const target = ordered.find((p) => p.id !== phaseId)
      if (!target) {
        toast.error('A project must keep at least one phase.')
        return
      }
      const snapshot = state
      let cursor = tasks
        .filter((t) => t.phase_id === target.id)
        .reduce((m, t) => Math.max(m, t.position + 1), 0)
      const moving = tasks
        .filter((t) => t.phase_id === phaseId)
        .sort((a, b) => a.position - b.position)

      const nextTasks = tasks.map((t) => {
        if (t.phase_id !== phaseId) return t
        const order = moving.findIndex((m) => m.id === t.id)
        return { ...t, phase_id: target.id, position: cursor + order }
      })
      cursor += moving.length

      setState((s) => ({
        ...s,
        phases: s.phases.filter((p) => p.id !== phaseId),
        tasks: nextTasks,
        // Comments stamped to the deleted phase become "Unphased" (SET NULL).
        comments: s.comments.map((c) =>
          c.phase_id === phaseId ? { ...c, phase_id: null } : c,
        ),
      }))

      try {
        if (moving.length > 0) {
          const results = await Promise.all(
            nextTasks
              .filter((t) => moving.some((m) => m.id === t.id))
              .map((t) =>
                supabase
                  .from('tasks')
                  .update({ phase_id: t.phase_id, position: t.position })
                  .eq('id', t.id),
              ),
          )
          const failed = results.find((r) => r.error)
          if (failed?.error) throw failed.error
        }
        const { error } = await supabase
          .from('phases')
          .delete()
          .eq('id', phaseId)
        if (error) throw error
      } catch (e) {
        setState(snapshot)
        toast.error(
          `Could not delete phase: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [phases, tasks, state, toast],
  )

  // ---- Comment mutations --------------------------------------------------
  const addComment = useCallback(
    async (taskId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const task = tasks.find((t) => t.id === taskId)
      try {
        const { data, error } = await supabase
          .from('comments')
          .insert({
            task_id: taskId,
            phase_id: task?.phase_id ?? null, // stamp CURRENT phase
            content: trimmed,
          })
          .select()
          .single()
        if (error) throw error
        const newComment = data as Comment

        let nextAuthors = state.authors
        if (newComment.created_by && !nextAuthors[newComment.created_by]) {
          const { data: prof } = await supabase
            .from('public_profiles')
            .select('id, full_name, moodle_username')
            .eq('id', newComment.created_by)
            .single()
          if (prof) {
            nextAuthors = { ...nextAuthors, [prof.id]: prof as PublicProfile }
          }
        }

        setState((s) => ({
          ...s,
          comments: [...s.comments, newComment],
          authors: nextAuthors,
        }))
      } catch (e) {
        toast.error(
          `Could not add comment: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [tasks, toast, state.authors],
  )

  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const snapshot = comments
      const updated_at = nowIso()
      setState((s) => ({
        ...s,
        comments: s.comments.map((c) =>
          c.id === commentId ? { ...c, content: trimmed, updated_at } : c,
        ),
      }))
      try {
        // Update content + updated_at ONLY — never the phase stamp.
        const { error } = await supabase
          .from('comments')
          .update({ content: trimmed, updated_at })
          .eq('id', commentId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, comments: snapshot }))
        toast.error(
          `Could not edit comment: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [comments, toast],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      const snapshot = comments
      setState((s) => ({
        ...s,
        comments: s.comments.filter((c) => c.id !== commentId),
      }))
      try {
        const { error } = await supabase
          .from('comments')
          .delete()
          .eq('id', commentId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, comments: snapshot }))
        toast.error(
          `Could not delete comment: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [comments, toast],
  )

  // ---- Phase report (AI) --------------------------------------------------
  /**
   * Generate (or regenerate) the AI report for a phase via the Edge Function,
   * then upsert it into phase_reports. Returns the saved report.
   * Throws on failure so the modal can surface an inline error.
   */
  const generatePhaseReport = useCallback(
    async (phaseId: string): Promise<PhaseReport> => {
      if (!project) throw new Error('Project not loaded')
      const phase = orderedPhases.find((p) => p.id === phaseId)
      if (!phase) throw new Error('Phase not found')

      const idx = orderedPhases.findIndex((p) => p.id === phaseId)
      const nextPhaseName =
        idx >= 0 && idx < orderedPhases.length - 1
          ? orderedPhases[idx + 1].name
          : null

      const phaseTasks = (tasksByPhase.get(phaseId) ?? []).map((t) => ({
        title: t.title,
        status: t.status,
      }))
      // PHASE-STAMPED comments: stamped to this phase regardless of where the
      // task now lives. Chronological order.
      const phaseComments = comments
        .filter((c) => c.phase_id === phaseId)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .map((c) => ({ content: c.content, createdAt: c.created_at }))

      const payload = {
        projectName: project.name,
        projectDescription: project.description,
        phaseName: phase.name,
        weekNumber: phase.week_number,
        tasks: phaseTasks,
        comments: phaseComments,
        nextPhaseName,
      }

      const { data, error } = await supabase.functions.invoke(
        'generate-phase-report',
        { body: payload },
      )

      if (error) {
        // Try to surface the function's JSON { error } body.
        let message = error.message
        try {
          const ctx = (error as { context?: Response }).context
          if (ctx && typeof ctx.json === 'function') {
            const parsed = await ctx.json()
            if (parsed?.error) message = parsed.error
          }
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }

      const content = (data as { content?: string })?.content?.trim()
      if (!content) throw new Error('The report came back empty.')

      const now = nowIso()
      const { data: saved, error: upErr } = await supabase
        .from('phase_reports')
        .upsert(
          {
            project_id: project.id,
            phase_id: phaseId,
            content,
            generated_at: now,
            updated_at: now,
          },
          { onConflict: 'project_id,phase_id' },
        )
        .select()
        .single()
      if (upErr) throw upErr

      const savedReport = saved as PhaseReport
      setState((s) => ({
        ...s,
        reports: [
          ...s.reports.filter((r) => r.phase_id !== phaseId),
          savedReport,
        ],
      }))
      return savedReport
    },
    [project, orderedPhases, tasksByPhase, comments],
  )

  const saveReportContent = useCallback(
    async (phaseId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const existing = reports.find((r) => r.phase_id === phaseId)
      if (!existing) return
      const snapshot = reports
      const updated_at = nowIso()
      setState((s) => ({
        ...s,
        reports: s.reports.map((r) =>
          r.phase_id === phaseId ? { ...r, content: trimmed, updated_at } : r,
        ),
      }))
      try {
        const { error } = await supabase
          .from('phase_reports')
          .update({ content: trimmed, updated_at })
          .eq('id', existing.id)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, reports: snapshot }))
        toast.error(
          `Could not save report: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [reports, toast],
  )

  // ---- Project settings ---------------------------------------------------
  const updateSettings = useCallback(
    async (
      patch: Partial<
        Pick<
          Project,
          | 'name'
          | 'description'
          | 'standup_day'
          | 'standup_time'
          | 'initial_meet_date'
        >
      >,
    ) => {
      if (!project) return
      const snapshot = project
      setState((s) => ({
        ...s,
        project: s.project ? { ...s.project, ...patch } : s.project,
      }))
      try {
        const { error } = await supabase
          .from('projects')
          .update(patch)
          .eq('id', project.id)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, project: snapshot }))
        toast.error(
          `Could not save settings: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [project, toast],
  )

  return {
    // data
    project,
    phases: orderedPhases,
    tasks,
    comments,
    authors,
    tasksByPhase,
    commentCountByTask,
    assignedInterns,
    reportsByPhase,
    // status
    loading,
    loadError,
    reload: loadAll,
    // derived helpers
    isPhaseCleared,
    // task mutations
    addTask,
    updateTaskTitle,
    setTaskStatus,
    deleteTask,
    commitTasks,
    advancePhase,
    // phase mutations
    addPhase,
    renamePhase,
    deletePhase,
    // comment mutations
    addComment,
    updateComment,
    deleteComment,
    // reports
    generatePhaseReport,
    saveReportContent,
    // settings
    updateSettings,
  }
}

export type UseProjectBoard = ReturnType<typeof useProjectBoard>
