import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { suggestInitials } from '../lib/roleStyles'
import type {
  AppRole,
  Intern,
  Profile,
  Project,
  ProjectIntern,
  Role,
} from '../types'

interface AdminState {
  profiles: Profile[]
  interns: Intern[]
  projects: Project[]
  assignments: ProjectIntern[]
}

const EMPTY: AdminState = {
  profiles: [],
  interns: [],
  projects: [],
  assignments: [],
}

export function useAdmin() {
  const toast = useToast()
  const [state, setState] = useState<AdminState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { profiles, interns, projects, assignments } = state

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [profilesR, internsR, projectsR, assignsR] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at'),
        supabase.from('interns').select('*').order('name'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('project_interns').select('*'),
      ])
      const err =
        profilesR.error || internsR.error || projectsR.error || assignsR.error
      if (err) throw err
      setState({
        profiles: (profilesR.data as Profile[]) ?? [],
        interns: (internsR.data as Intern[]) ?? [],
        projects: (projectsR.data as Project[]) ?? [],
        assignments: (assignsR.data as ProjectIntern[]) ?? [],
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ---- Derived ------------------------------------------------------------
  const internByMoodleId = useMemo(() => {
    const map = new Map<number, Intern>()
    for (const i of interns) if (i.moodle_user_id != null) map.set(i.moodle_user_id, i)
    return map
  }, [interns])

  /** The roster record a profile is linked to (by moodle_user_id), if any. */
  const linkedInternForProfile = useCallback(
    (p: Profile): Intern | null =>
      p.moodle_user_id != null
        ? (internByMoodleId.get(p.moodle_user_id) ?? null)
        : null,
    [internByMoodleId],
  )

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

  // ---- Profile mutations --------------------------------------------------
  const setRole = useCallback(
    async (profileId: string, role: AppRole) => {
      const snapshot = profiles
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === profileId ? { ...p, app_role: role } : p,
        ),
      }))
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ app_role: role })
          .eq('id', profileId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, profiles: snapshot }))
        toast.error(
          `Could not change role: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [profiles, toast],
  )

  const setActive = useCallback(
    async (profileId: string, active: boolean) => {
      const snapshot = profiles
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === profileId ? { ...p, is_active: active } : p,
        ),
      }))
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: active })
          .eq('id', profileId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, profiles: snapshot }))
        toast.error(
          `Could not update access: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [profiles, toast],
  )

  // ---- Linking profile <-> intern -----------------------------------------
  const linkProfileToIntern = useCallback(
    async (profile: Profile, internId: string) => {
      if (profile.moodle_user_id == null) {
        toast.error('This account has no Moodle id and cannot be linked.')
        return
      }
      const snapshot = interns
      const moodleId = profile.moodle_user_id
      // Clear this moodle id off any other intern, then set it on the target.
      setState((s) => ({
        ...s,
        interns: s.interns.map((i) => {
          if (i.id === internId) return { ...i, moodle_user_id: moodleId }
          if (i.moodle_user_id === moodleId) return { ...i, moodle_user_id: null }
          return i
        }),
      }))
      try {
        // Detach any other intern currently holding this moodle id (unique idx).
        const prevHolder = interns.find(
          (i) => i.moodle_user_id === moodleId && i.id !== internId,
        )
        if (prevHolder) {
          const { error } = await supabase
            .from('interns')
            .update({ moodle_user_id: null })
            .eq('id', prevHolder.id)
          if (error) throw error
        }
        const { error } = await supabase
          .from('interns')
          .update({ moodle_user_id: moodleId })
          .eq('id', internId)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, interns: snapshot }))
        toast.error(
          `Could not link: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [interns, toast],
  )

  const unlinkProfile = useCallback(
    async (profile: Profile) => {
      const linked = linkedInternForProfile(profile)
      if (!linked) return
      const snapshot = interns
      setState((s) => ({
        ...s,
        interns: s.interns.map((i) =>
          i.id === linked.id ? { ...i, moodle_user_id: null } : i,
        ),
      }))
      try {
        const { error } = await supabase
          .from('interns')
          .update({ moodle_user_id: null })
          .eq('id', linked.id)
        if (error) throw error
      } catch (e) {
        setState((s) => ({ ...s, interns: snapshot }))
        toast.error(
          `Could not unlink: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [interns, linkedInternForProfile, toast],
  )

  /** Create a fresh roster record from a profile and link it. */
  const createInternForProfile = useCallback(
    async (profile: Profile, role: Role) => {
      if (profile.moodle_user_id == null) {
        toast.error('This account has no Moodle id and cannot be linked.')
        return
      }
      const name = profile.full_name?.trim() || profile.moodle_username || 'New intern'
      try {
        const { data, error } = await supabase
          .from('interns')
          .insert({
            name,
            initials: suggestInitials(name),
            role,
            moodle_user_id: profile.moodle_user_id,
          })
          .select()
          .single()
        if (error) throw error
        setState((s) => ({ ...s, interns: [...s.interns, data as Intern] }))
      } catch (e) {
        toast.error(
          `Could not create roster record: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [toast],
  )

  // ---- Assignment ---------------------------------------------------------
  const setAssignment = useCallback(
    async (projectId: string, internId: string, assigned: boolean) => {
      const exists = assignments.some(
        (a) => a.project_id === projectId && a.intern_id === internId,
      )
      if (assigned === exists) return
      const snapshot = assignments
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
    profiles,
    interns,
    projects,
    assignments,
    internsByProject,
    linkedInternForProfile,
    loading,
    loadError,
    reload: loadAll,
    setRole,
    setActive,
    linkProfileToIntern,
    unlinkProfile,
    createInternForProfile,
    setAssignment,
  }
}

export type UseAdmin = ReturnType<typeof useAdmin>
