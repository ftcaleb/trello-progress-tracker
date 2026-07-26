import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { ROLE_ORDER } from '../types'
import type { Intern, Team, TeamMember, TeamProject } from '../types'

interface TeamsState {
  teams: Team[]
  members: TeamMember[]
  projects: TeamProject[]
}

const EMPTY: TeamsState = { teams: [], members: [], projects: [] }

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

/** Order members by role (dev → designer → cyber), then by name. */
function memberSort(a: TeamMember, b: TeamMember): number {
  const ra = ROLE_ORDER.indexOf(a.role)
  const rb = ROLE_ORDER.indexOf(b.role)
  if (a.position !== b.position) return a.position - b.position
  if (ra !== rb) return ra - rb
  return a.name.localeCompare(b.name)
}

export function useTeams() {
  const toast = useToast()
  const [state, setState] = useState<TeamsState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { teams, members, projects } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [teamsR, membersR, projectsR] = await Promise.all([
        supabase.from('teams').select('*').order('position'),
        supabase.from('team_members').select('*').order('position'),
        supabase.from('team_projects').select('*').order('position'),
      ])
      if (teamsR.error) throw teamsR.error
      if (membersR.error) throw membersR.error
      if (projectsR.error) throw projectsR.error
      setState({
        teams: (teamsR.data as Team[]) ?? [],
        members: (membersR.data as TeamMember[]) ?? [],
        projects: (projectsR.data as TeamProject[]) ?? [],
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

  const membersByTeam = useMemo(() => {
    const m = new Map<string, TeamMember[]>()
    for (const t of teams) m.set(t.id, [])
    for (const mem of members) {
      const list = m.get(mem.team_id)
      if (list) list.push(mem)
    }
    for (const list of m.values()) list.sort(memberSort)
    return m
  }, [members, teams])

  const projectsByTeam = useMemo(() => {
    const m = new Map<string, TeamProject[]>()
    for (const t of teams) m.set(t.id, [])
    for (const p of projects) {
      const list = m.get(p.team_id)
      if (list) list.push(p)
    }
    for (const list of m.values()) list.sort((a, b) => a.position - b.position)
    return m
  }, [projects, teams])

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
        toast.error(`Could not add team: ${msg(e)}`)
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
        toast.error(`Could not rename team: ${msg(e)}`)
      }
    },
    [teams, toast],
  )

  const deleteTeam = useCallback(
    async (teamId: string) => {
      const snapshot = state
      setState((s) => ({
        teams: s.teams.filter((t) => t.id !== teamId),
        members: s.members.filter((m) => m.team_id !== teamId),
        projects: s.projects.filter((p) => p.team_id !== teamId),
      }))
      try {
        const { error } = await supabase.from('teams').delete().eq('id', teamId)
        if (error) throw error
      } catch (e) {
        setState(snapshot)
        toast.error(`Could not delete team: ${msg(e)}`)
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
        toast.error(`Could not reorder teams: ${msg(e)}`)
      }
    },
    [teams, toast],
  )

  // ---- Project (label) mutations ------------------------------------------
  const addProject = useCallback(
    async (teamId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const list = projectsByTeam.get(teamId) ?? []
      const position = list.reduce((mx, p) => Math.max(mx, p.position + 1), 0)
      try {
        const { data, error } = await supabase
          .from('team_projects')
          .insert({ team_id: teamId, name: trimmed, position })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({ ...s, projects: [...s.projects, data as TeamProject] }))
      } catch (e) {
        toast.error(`Could not add project: ${msg(e)}`)
      }
    },
    [projectsByTeam, toast],
  )

  const removeProject = useCallback(
    async (projectId: string) => {
      const snapshot = projects
      setState((s) => ({
        ...s,
        projects: s.projects.filter((p) => p.id !== projectId),
      }))
      try {
        const { error } = await supabase
          .from('team_projects')
          .delete()
          .eq('id', projectId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, projects: snapshot }))
        toast.error(`Could not remove project: ${msg(e)}`)
      }
    },
    [projects, toast],
  )

  // ---- Member mutations ---------------------------------------------------
  const addMember = useCallback(
    async (teamId: string, intern: Intern) => {
      if (
        members.some(
          (m) => m.team_id === teamId && m.intern_id === intern.id,
        )
      ) {
        toast.error(`${intern.name} is already on this team.`)
        return
      }
      const list = membersByTeam.get(teamId) ?? []
      const position = list.reduce((mx, m) => Math.max(mx, m.position + 1), 0)
      try {
        const { data, error } = await supabase
          .from('team_members')
          .insert({
            team_id: teamId,
            intern_id: intern.id,
            name: intern.name,
            initials: intern.initials,
            role: intern.role,
            is_active: true,
            position,
          })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({ ...s, members: [...s.members, data as TeamMember] }))
      } catch (e) {
        toast.error(`Could not add member: ${msg(e)}`)
      }
    },
    [members, membersByTeam, toast],
  )

  const removeMember = useCallback(
    async (memberId: string) => {
      const snapshot = members
      setState((s) => ({
        ...s,
        members: s.members.filter((m) => m.id !== memberId),
      }))
      try {
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, members: snapshot }))
        toast.error(`Could not remove member: ${msg(e)}`)
      }
    },
    [members, toast],
  )

  /** Move a membership to another team (drag-and-drop). */
  const moveMember = useCallback(
    async (memberId: string, toTeamId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member || member.team_id === toTeamId) return

      // A person can be on several teams, but not twice on the same one.
      if (
        member.intern_id &&
        members.some(
          (m) =>
            m.team_id === toTeamId &&
            m.intern_id === member.intern_id &&
            m.id !== memberId,
        )
      ) {
        toast.error(`${member.name} is already on that team.`)
        return
      }

      const list = membersByTeam.get(toTeamId) ?? []
      const position = list.reduce((mx, m) => Math.max(mx, m.position + 1), 0)
      const snapshot = members
      setState((s) => ({
        ...s,
        members: s.members.map((m) =>
          m.id === memberId ? { ...m, team_id: toTeamId, position } : m,
        ),
      }))
      try {
        const { error } = await supabase
          .from('team_members')
          .update({ team_id: toTeamId, position })
          .eq('id', memberId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, members: snapshot }))
        toast.error(`Could not move member: ${msg(e)}`)
      }
    },
    [members, membersByTeam, toast],
  )

  const toggleMemberActive = useCallback(
    async (memberId: string, active: boolean) => {
      const snapshot = members
      setState((s) => ({
        ...s,
        members: s.members.map((m) =>
          m.id === memberId ? { ...m, is_active: active } : m,
        ),
      }))
      try {
        const { error } = await supabase
          .from('team_members')
          .update({ is_active: active })
          .eq('id', memberId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, members: snapshot }))
        toast.error(`Could not update member: ${msg(e)}`)
      }
    },
    [members, toast],
  )

  return {
    teams: orderedTeams,
    members,
    projects,
    membersByTeam,
    projectsByTeam,
    loading,
    loadError,
    reload: loadAll,
    createTeam,
    renameTeam,
    deleteTeam,
    reorderTeams,
    addProject,
    removeProject,
    addMember,
    removeMember,
    moveMember,
    toggleMemberActive,
  }
}

export type UseTeams = ReturnType<typeof useTeams>
