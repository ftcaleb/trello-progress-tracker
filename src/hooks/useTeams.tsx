import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { ROLE_ORDER } from '../types'
import type { Intern, Project, Role, Team } from '../types'

/** One row of the public teams_overview view (display fields only). */
interface OverviewRow {
  team_id: string
  project_id: string
  project_name: string
  intern_id: string | null
  intern_name: string | null
  intern_initials: string | null
  intern_role: Role | null
}

interface TeamsState {
  teams: Team[]
  overview: OverviewRow[]
  /** All projects the viewer may see (admin: all) — for the add/move picker. */
  projects: Project[]
}

const EMPTY: TeamsState = { teams: [], overview: [], projects: [] }

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

function internSort(a: Intern, b: Intern): number {
  const ra = ROLE_ORDER.indexOf(a.role)
  const rb = ROLE_ORDER.indexOf(b.role)
  if (ra !== rb) return ra - rb
  return a.name.localeCompare(b.name)
}

/** Build a display-only Project from a view row (fields the Teams UI reads). */
function toProject(teamId: string | null, id: string, name: string): Project {
  return {
    id,
    name,
    team_id: teamId,
    description: null,
    standup_day: '',
    standup_time: '',
    initial_meet_date: null,
    created_at: '',
  }
}

/**
 * Groups are a lens over REAL data. Display data is read from the public
 * `teams_overview` view (so every signed-in user sees the full showcase,
 * read-only), while admin mutations write to the underlying tables. One
 * source of truth, no drift, base-table RLS untouched.
 */
export function useTeams() {
  const toast = useToast()
  const [state, setState] = useState<TeamsState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { teams, overview, projects } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [teamsR, overviewR, projectsR] = await Promise.all([
        supabase.from('teams').select('*').order('position'),
        supabase.from('teams_overview').select('*'),
        supabase.from('projects').select('*').order('name'),
      ])
      if (teamsR.error) throw teamsR.error
      if (overviewR.error) throw overviewR.error
      if (projectsR.error) throw projectsR.error
      setState({
        teams: (teamsR.data as Team[]) ?? [],
        overview: (overviewR.data as OverviewRow[]) ?? [],
        projects: (projectsR.data as Project[]) ?? [],
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

  const projectsByTeam = useMemo(() => {
    const m = new Map<string, Project[]>()
    for (const t of teams) m.set(t.id, [])
    const seen = new Set<string>()
    for (const r of overview) {
      if (seen.has(r.project_id)) continue
      seen.add(r.project_id)
      const list = m.get(r.team_id)
      if (list) list.push(toProject(r.team_id, r.project_id, r.project_name))
    }
    for (const list of m.values())
      list.sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [overview, teams])

  const internsByProject = useMemo(() => {
    const m = new Map<string, Intern[]>()
    const seen = new Set<string>()
    for (const r of overview) {
      if (!r.intern_id || !r.intern_role) continue
      const key = `${r.project_id}:${r.intern_id}`
      if (seen.has(key)) continue
      seen.add(key)
      const list = m.get(r.project_id) ?? []
      list.push({
        id: r.intern_id,
        name: r.intern_name ?? '',
        initials: r.intern_initials ?? '',
        role: r.intern_role,
        moodle_user_id: null,
      })
      m.set(r.project_id, list)
    }
    for (const list of m.values()) list.sort(internSort)
    return m
  }, [overview])

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

  // ---- Team mutations (admin) --------------------------------------------
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
        teams: s.teams.filter((t) => t.id !== teamId),
        overview: s.overview.filter((r) => r.team_id !== teamId),
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

  // ---- Project <-> group link (admin) ------------------------------------
  /** Assign / move a project to a group (null = Unassigned). */
  const setProjectTeam = useCallback(
    async (projectId: string, teamId: string | null) => {
      const snapshot = state
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, team_id: teamId } : p,
        ),
        // Keep the showcase in sync: move the project's rows to the new group,
        // or drop them if it was unassigned.
        overview:
          teamId === null
            ? s.overview.filter((r) => r.project_id !== projectId)
            : s.overview.map((r) =>
                r.project_id === projectId ? { ...r, team_id: teamId } : r,
              ),
      }))
      try {
        const { error } = await supabase
          .from('projects')
          .update({ team_id: teamId })
          .eq('id', projectId)
        if (error) throw error
        // Re-pull so a newly-assigned project brings its members into view.
        void loadAll()
      } catch (e) {
        setState(snapshot)
        toast.error(`Could not move project: ${msg(e)}`)
      }
    },
    [state, toast, loadAll],
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
