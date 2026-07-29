import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useInterns } from './useInterns'
import type {
  Intern,
  Phase,
  PhaseReport,
  Project,
  ProjectIntern,
  TaskStatus,
  Team,
} from '../types'

interface TaskLite {
  id: string
  project_id: string
  phase_id: string
  status: TaskStatus
}

interface PortfolioState {
  projects: Project[]
  phases: Phase[]
  assignments: ProjectIntern[]
  tasks: TaskLite[]
  reports: PhaseReport[]
  teams: Team[]
}

const EMPTY: PortfolioState = {
  projects: [],
  phases: [],
  assignments: [],
  tasks: [],
  reports: [],
  teams: [],
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

export interface ProjectProgress {
  /** The active phase to work on next (first incomplete); null when all done. */
  currentPhase: Phase | null
  /** Phases where every task is approved. */
  completedPhases: number
  totalPhases: number
  /** completedPhases / totalPhases, 0–100 (rounded). */
  percent: number
  /** True once the project has any task at all. */
  started: boolean
}

export function usePortfolio() {
  const toast = useToast()
  const { interns } = useInterns()
  const [state, setState] = useState<PortfolioState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { projects, phases, assignments, tasks, reports, teams } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [projectsR, phasesR, assignmentsR, tasksR, reportsR, teamsR] =
        await Promise.all([
          supabase.from('projects').select('*').order('name'),
          supabase.from('phases').select('*').order('position'),
          supabase.from('project_interns').select('*'),
          supabase.from('tasks').select('id, project_id, phase_id, status'),
          supabase.from('phase_reports').select('*'),
          supabase.from('teams').select('*').order('position'),
        ])
      const err =
        projectsR.error ||
        phasesR.error ||
        assignmentsR.error ||
        tasksR.error ||
        reportsR.error ||
        teamsR.error
      if (err) throw err

      setState({
        projects: (projectsR.data as Project[]) ?? [],
        phases: (phasesR.data as Phase[]) ?? [],
        assignments: (assignmentsR.data as ProjectIntern[]) ?? [],
        tasks: (tasksR.data as TaskLite[]) ?? [],
        reports: (reportsR.data as PhaseReport[]) ?? [],
        teams: (teamsR.data as Team[]) ?? [],
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load portfolio.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ---- Derived ------------------------------------------------------------
  const phasesByProject = useMemo(() => {
    const map = new Map<string, Phase[]>()
    for (const p of phases) {
      const list = map.get(p.project_id) ?? []
      list.push(p)
      map.set(p.project_id, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position)
    return map
  }, [phases])

  // Tasks grouped by phase — the basis for phase completion.
  const tasksByPhase = useMemo(() => {
    const map = new Map<string, TaskLite[]>()
    for (const t of tasks) {
      const list = map.get(t.phase_id) ?? []
      list.push(t)
      map.set(t.phase_id, list)
    }
    return map
  }, [tasks])

  const progressByProject = useMemo(() => {
    // A phase is complete when it has tasks and every one is approved.
    const isComplete = (phaseId: string) => {
      const list = tasksByPhase.get(phaseId)
      return Boolean(list && list.length > 0 && list.every((t) => t.status === 'approved'))
    }

    const map = new Map<string, ProjectProgress>()
    for (const project of projects) {
      const projectPhases = phasesByProject.get(project.id) ?? []
      const total = projectPhases.length
      const completed = projectPhases.reduce(
        (n, ph) => n + (isComplete(ph.id) ? 1 : 0),
        0,
      )
      const started = projectPhases.some(
        (ph) => (tasksByPhase.get(ph.id)?.length ?? 0) > 0,
      )
      const firstIncomplete = projectPhases.find((ph) => !isComplete(ph.id))
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0

      map.set(project.id, {
        // When everything is approved there's no active phase.
        currentPhase: percent === 100 ? null : (firstIncomplete ?? null),
        completedPhases: completed,
        totalPhases: total,
        percent,
        started,
      })
    }
    return map
  }, [projects, phasesByProject, tasksByPhase])

  const internsByProject = useMemo(() => {
    const byId = new Map(interns.map((i) => [i.id, i]))
    const map = new Map<string, Intern[]>()
    for (const a of assignments) {
      const intern = byId.get(a.intern_id)
      if (!intern) continue
      const list = map.get(a.project_id) ?? []
      list.push(intern)
      map.set(a.project_id, list)
    }
    return map
  }, [assignments, interns])

  const reportCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of reports)
      map.set(r.project_id, (map.get(r.project_id) ?? 0) + 1)
    return map
  }, [reports])

  const latestReportByProject = useMemo(() => {
    const map = new Map<string, PhaseReport>()
    for (const r of reports) {
      const existing = map.get(r.project_id)
      if (
        !existing ||
        new Date(r.updated_at).getTime() > new Date(existing.updated_at).getTime()
      ) {
        map.set(r.project_id, r)
      }
    }
    return map
  }, [reports])

  /** Compile the latest report per project into one clipboard-ready document. */
  const copyAllReports = useCallback(async () => {
    const withReports = projects
      .filter((p) => latestReportByProject.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    const missing = projects
      .filter((p) => !latestReportByProject.has(p.id))
      .map((p) => p.name)

    if (withReports.length === 0) {
      toast.error('No reports saved yet — generate some first.')
      return
    }

    const dateStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const title = `Founder's Institute Projects — Progress Status Report — ${dateStr}`
    const body = withReports
      .map((p) => latestReportByProject.get(p.id)!.content.trim())
      .join('\n\n---\n\n')
    const text = `${title}\n\n${body}`

    try {
      await navigator.clipboard.writeText(text)
      const n = withReports.length
      const missingNote =
        missing.length > 0
          ? ` Missing: ${missing.join(', ')}.`
          : ' All projects included.'
      toast.success(
        `Copied ${n} project section${n === 1 ? '' : 's'}.${missingNote}`,
      )
    } catch {
      toast.error('Could not copy to clipboard.')
    }
  }, [projects, latestReportByProject, toast])

  // ---- Project CRUD -------------------------------------------------------
  /** Create a real project. Sensible standup defaults; edit the rest in Settings. */
  const createProject = useCallback(
    async (name: string, teamId: string | null = null) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      try {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: trimmed,
            standup_day: 'Monday',
            standup_time: '09:00',
            team_id: teamId,
          })
          .select()
          .single()
        if (error) throw error
        const created = data as Project
        setState((s) => ({ ...s, projects: [...s.projects, created] }))
        return created
      } catch (e) {
        toast.error(`Could not create project: ${msg(e)}`)
        return null
      }
    },
    [toast],
  )

  /** Delete a project and all of its children via the admin-only RPC. */
  const deleteProject = useCallback(
    async (projectId: string) => {
      const snapshot = state
      setState((s) => ({
        ...s,
        projects: s.projects.filter((p) => p.id !== projectId),
        assignments: s.assignments.filter((a) => a.project_id !== projectId),
        phases: s.phases.filter((p) => p.project_id !== projectId),
        tasks: s.tasks.filter((t) => t.project_id !== projectId),
        reports: s.reports.filter((r) => r.project_id !== projectId),
      }))
      try {
        const { error } = await supabase.rpc('delete_project', {
          p_id: projectId,
        })
        if (error) throw error
      } catch (e) {
        setState(snapshot)
        toast.error(`Could not delete project: ${msg(e)}`)
      }
    },
    [state, toast],
  )

  /** Assign / move a project to a group (null = Unassigned). */
  const setProjectGroup = useCallback(
    async (projectId: string, teamId: string | null) => {
      const snapshot = projects
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, team_id: teamId } : p,
        ),
      }))
      try {
        const { error } = await supabase
          .from('projects')
          .update({ team_id: teamId })
          .eq('id', projectId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, projects: snapshot }))
        toast.error(`Could not change group: ${msg(e)}`)
      }
    },
    [projects, toast],
  )

  // ---- Assignment toggle --------------------------------------------------
  const setAssignment = useCallback(
    async (projectId: string, internId: string, assigned: boolean) => {
      const snapshot = assignments
      const exists = assignments.some(
        (a) => a.project_id === projectId && a.intern_id === internId,
      )
      if (assigned === exists) return

      setState((s) => ({
        ...s,
        assignments: assigned
          ? [...s.assignments, { project_id: projectId, intern_id: internId }]
          : s.assignments.filter(
              (a) => !(a.project_id === projectId && a.intern_id === internId),
            ),
      }))

      try {
        if (assigned) {
          const { error } = await supabase
            .from('project_interns')
            .insert({ project_id: projectId, intern_id: internId })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('project_interns')
            .delete()
            .eq('project_id', projectId)
            .eq('intern_id', internId)
          if (error) throw error
        }
      } catch (e) {
        setState((s) => ({ ...s, assignments: snapshot }))
        toast.error(
          `Could not update assignment: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [assignments, toast],
  )

  return {
    projects,
    interns,
    loading,
    loadError,
    reload: loadAll,
    progressByProject,
    internsByProject,
    reportCountByProject,
    copyAllReports,
    assignments,
    setAssignment,
    teams,
    createProject,
    deleteProject,
    setProjectGroup,
  }
}

export type UsePortfolio = ReturnType<typeof usePortfolio>
