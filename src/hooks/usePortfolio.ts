import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useInterns } from './useInterns'
import type { Intern, Phase, Project, ProjectIntern } from '../types'

interface TaskLite {
  id: string
  project_id: string
  phase_id: string
}

interface PortfolioState {
  projects: Project[]
  phases: Phase[]
  assignments: ProjectIntern[]
  tasks: TaskLite[]
}

const EMPTY: PortfolioState = {
  projects: [],
  phases: [],
  assignments: [],
  tasks: [],
}

export interface ProjectProgress {
  currentPhase: Phase | null
  phaseIndex: number // 0-based index of current phase, -1 if not started
  totalPhases: number
  started: boolean
}

export function usePortfolio() {
  const toast = useToast()
  const { interns } = useInterns()
  const [state, setState] = useState<PortfolioState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { projects, phases, assignments, tasks } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [projectsR, phasesR, assignmentsR, tasksR] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('phases').select('*').order('position'),
        supabase.from('project_interns').select('*'),
        supabase.from('tasks').select('id, project_id, phase_id'),
      ])
      const err =
        projectsR.error || phasesR.error || assignmentsR.error || tasksR.error
      if (err) throw err

      setState({
        projects: (projectsR.data as Project[]) ?? [],
        phases: (phasesR.data as Phase[]) ?? [],
        assignments: (assignmentsR.data as ProjectIntern[]) ?? [],
        tasks: (tasksR.data as TaskLite[]) ?? [],
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

  const phasesWithTasks = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) set.add(t.phase_id)
    return set
  }, [tasks])

  const progressByProject = useMemo(() => {
    const map = new Map<string, ProjectProgress>()
    for (const project of projects) {
      const projectPhases = phasesByProject.get(project.id) ?? []
      const current = projectPhases.find((ph) => phasesWithTasks.has(ph.id))
      map.set(project.id, {
        currentPhase: current ?? null,
        phaseIndex: current
          ? projectPhases.findIndex((ph) => ph.id === current.id)
          : -1,
        totalPhases: projectPhases.length,
        started: Boolean(current),
      })
    }
    return map
  }, [projects, phasesByProject, phasesWithTasks])

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
    assignments,
    setAssignment,
  }
}

export type UsePortfolio = ReturnType<typeof usePortfolio>
