import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import type { Intern, Role } from '../types'

interface InternsContextValue {
  interns: Intern[]
  loading: boolean
  reload: () => Promise<void>
  addIntern: (input: {
    name: string
    initials: string
    role: Role
  }) => Promise<void>
  updateIntern: (
    id: string,
    patch: Partial<Pick<Intern, 'name' | 'initials' | 'role'>>,
  ) => Promise<void>
  deleteIntern: (id: string) => Promise<void>
}

const InternsContext = createContext<InternsContextValue | null>(null)

export function InternsProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [interns, setInterns] = useState<Intern[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('interns')
      .select('*')
      .order('name')
    if (error) {
      toast.error(`Could not load interns: ${error.message}`)
    } else {
      setInterns((data as Intern[]) ?? [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const addIntern = useCallback<InternsContextValue['addIntern']>(
    async (input) => {
      const payload = {
        name: input.name.trim(),
        initials: input.initials.trim().toUpperCase(),
        role: input.role,
      }
      if (!payload.name) return
      try {
        const { data, error } = await supabase
          .from('interns')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        setInterns((prev) => [...prev, data as Intern])
      } catch (e) {
        toast.error(
          `Could not add intern: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [toast],
  )

  const updateIntern = useCallback<InternsContextValue['updateIntern']>(
    async (id, patch) => {
      const normalized = {
        ...patch,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.initials !== undefined
          ? { initials: patch.initials.trim().toUpperCase() }
          : {}),
      }
      const snapshot = interns
      setInterns((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...normalized } : i)),
      )
      try {
        const { error } = await supabase
          .from('interns')
          .update(normalized)
          .eq('id', id)
        if (error) throw error
      } catch (e) {
        setInterns(snapshot)
        toast.error(
          `Could not update intern: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [interns, toast],
  )

  const deleteIntern = useCallback<InternsContextValue['deleteIntern']>(
    async (id) => {
      const snapshot = interns
      setInterns((prev) => prev.filter((i) => i.id !== id))
      try {
        const { error } = await supabase.from('interns').delete().eq('id', id)
        if (error) throw error
      } catch (e) {
        setInterns(snapshot)
        toast.error(
          `Could not delete intern: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [interns, toast],
  )

  const value = useMemo<InternsContextValue>(
    () => ({
      interns,
      loading,
      reload,
      addIntern,
      updateIntern,
      deleteIntern,
    }),
    [interns, loading, reload, addIntern, updateIntern, deleteIntern],
  )

  return (
    <InternsContext.Provider value={value}>{children}</InternsContext.Provider>
  )
}

export function useInterns() {
  const ctx = useContext(InternsContext)
  if (!ctx) throw new Error('useInterns must be used within an InternsProvider')
  return ctx
}
