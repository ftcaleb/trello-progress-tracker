import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useInterns } from './useInterns'
import { ROLE_ORDER } from '../types'
import type { Intern, Project, ProjectIntern, Team } from '../types'

interface TeamsState {
  teams: Team[]
  projects: Project[]
  assignments: ProjectIntern[]
}

const EMPTY: TeamsState = { teams: [], projects: [], assignments: [] }

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

/** Order interns by role (dev → designer → cyber), then by name. */
function internSort(a: Intern, b: Intern): number {
  const ra = ROLE_ORDER.indexOf(a.role)
  const rb = ROLE_ORDER.indexOf(b.role)
  if (ra !== rb) return ra - rb
  return a.name.localeCompare(b.name)
}

/**
 * Groups are now a lens over REAL data — a group is its assigned projects
 * (projects.team_id) and the interns working on those projects
 * (project_interns). There is no separate team roster or project label; the
 * whole app shares one source of truth.
 */
export function useTeams() {
  const toast = useToast()
  const { interns } = useInterns()
  const [state, setState] = useState<TeamsState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { teams, projects, assignments } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [teamsR, projectsR, assignmentsR] = await Promise.all([
        supabase.from('teams').select('*').order('position'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('project_interns').select('*'),
      ])
      if (teamsR.error) throw teamsR.error
      if (projectsR.error) throw projectsR.error
      if (assignmentsR.error) throw assignmentsR.error
      setState({
        teams: (teamsR.data as Team[]) ?? [],
        projects: (projectsR.data as Project[]) ?? [],
        assignments: (assignmentsR.data as ProjectIntern[]) ?? [],
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load teams.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ---- Derived ------------------------------------------------------------
  const orderedTeams = useMemo(
    () =>
      [...teams].sort(
        (a, b) => a.position - b.position || a.name.localeCompare(b.name),
      ),
    [teams],
  )

  const internById = useMemo(
    () => new Map(interns.map((i) => [i.id, i])),
    [interns],
  )

  const projectsByTeam = useMemo(() => {
    const m = new Map<string, Project[]>()
    for (const t of teams) m.set(t.id, [])
    for (const p of projects) {
      if (p.team_id && m.has(p.team_id)) m.get(p.team_id)!.push(p)
    }
    for (const list of m.values())
      list.sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [projects, teams])

  const internsByProject = useMemo(() => {
    const m = new Map<string, Intern[]>()
    for (const a of assignments) {
      const intern = internById.get(a.intern_id)
      if (!intern) continue
      const list = m.get(a.project_id) ?? []
      list.push(intern)
      m.set(a.project_id, list)
    }
    for (const list of m.values()) list.sort(internSort)
    return m
  }, [assignments, internById])

  /** A group's people = every intern on any of its projects (deduped). */
  const internsByTeam = useMemo(() => {
    const m = new Map<string, Intern[]>()
    for (const t of teams) {
      const seen = new Set<string>()
      const list: Intern[] = []
      for (const p of projectsByTeam.get(t.id) ?? []) {
        for (const intern of internsByProject.get(p.id) ?? []) {
          if (!seen.has(intern.id)) {
            seen.add(intern.id)
            list.push(intern)
          }
        }
      }
      list.sort(internSort)
      m.set(t.id, list)
    }
    return m
  }, [teams, projectsByTeam, internsByProject])

  // ---- Team mutations -----------------------------------------------------
  const createTeam = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const position = teams.reduce((mx, t) => Math.max(mx, t.position + 1), 0)
      try {
        const { data, error } = await supabase
          .from('teams')
          .insert({ name: trimmed, position })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({ ...s, teams: [...s.teams, data as Team] }))
      } catch (e) {
        toast.error(`Could not add group: ${msg(e)}`)
      }
    },
    [teams, toast],
  )

  const renameTeam = useCallback(
    async (teamId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const snapshot = teams
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) =>
          t.id === teamId ? { ...t, name: trimmed } : t,
        ),
      }))
      try {
        const { error } = await supabase
          .from('teams')
          .update({ name: trimmed })
          .eq('id', teamId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, teams: snapshot }))
        toast.error(`Could not rename group: ${msg(e)}`)
      }
    },
    [teams, toast],
  )

  /** Delete a group. Its projects fall back to Unassigned (DB set null). */
  const deleteTeam = useCallback(
    async (teamId: string) => {
      const snapshot = state
      setState((s) => ({
        ...s,
        teams: s.teams.filter((t) => t.id !== teamId),
        projects: s.projects.map((p) =>
          p.team_id === teamId ? { ...p, team_id: null } : p,
        ),
      }))
      try {
        const { error } = await supabase.from('teams').delete().eq('id', teamId)
        if (error) throw error
      } catch (e) {
        setState(snapshot)
        toast.error(`Could not delete group: ${msg(e)}`)
      }
    },
    [state, toast],
  )

  /** Persist a new left-to-right ordering of team ids. */
  const reorderTeams = useCallback(
    async (orderedIds: string[]) => {
      const snapshot = teams
      const posById = new Map(orderedIds.map((id, i) => [id, i]))
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) =>
          posById.has(t.id) ? { ...t, position: posById.get(t.id)! } : t,
        ),
      }))
      try {
        const results = await Promise.all(
          orderedIds.map((id, i) =>
            supabase.from('teams').update({ position: i }).eq('id', id),
          ),
        )
        const failed = results.find((r) => r.error)
        if (failed?.error) throw failed.error
      } catch (e) {
        setState((s) => ({ ...s, teams: snapshot }))
        toast.error(`Could not reorder groups: ${msg(e)}`)
      }
    },
    [teams, toast],
  )

  // ---- Project ↔ group link ----------------------------------------------
  /** Assign / move a project to a group (null = Unassigned). */
  const setProjectTeam = useCallback(
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
        toast.error(`Could not move project: ${msg(e)}`)
      }
    },
    [projects, toast],
  )

  return {
    teams: orderedTeams,
    projects,
    projectsByTeam,
    internsByProject,
    internsByTeam,
    loading,
    loadError,
    reload: loadAll,
    createTeam,
    renameTeam,
    deleteTeam,
    reorderTeams,
    setProjectTeam,
  }
}

export type UseTeams = ReturnType<typeof useTeams>
