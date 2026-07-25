import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  profile: Profile | null
  profileLoading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithMoodle: (username: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

/** Pull the `{ error }` body out of a failed Edge Function response. */
async function edgeErrorMessage(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : 'Could not sign in.'
  try {
    const ctx = (error as { context?: Response })?.context
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json()
      if (body?.error) return body.error as string
    }
  } catch {
    /* ignore */
  }
  return fallback
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    // Restore any persisted session, then subscribe to changes.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (!error) setProfile((data as Profile) ?? null)
    setProfileLoading(false)
  }, [userId])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      profile,
      profileLoading,
      isAdmin: profile?.app_role === 'admin' && profile?.is_active !== false,
      refreshProfile: loadProfile,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      },
      // Moodle-backed sign-in: the Edge Function verifies the credentials
      // against Moodle and returns a one-time token hash, which we exchange
      // for a real Supabase session.
      signInWithMoodle: async (username, password) => {
        const { data, error } = await supabase.functions.invoke(
          'moodle-login',
          { body: { username, password } },
        )
        if (error) throw new Error(await edgeErrorMessage(error))

        const tokenHash = (data as { token_hash?: string })?.token_hash
        if (!tokenHash) throw new Error('Moodle sign-in did not return a session.')

        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        })
        if (otpErr) throw otpErr
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, profile, profileLoading, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/** Guard for protected routes: redirects to /login when there is no session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-navy-200 border-t-sunburst-500" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

/** Guard for admin-only routes. Assumes it is nested inside RequireAuth. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, loading, profile, profileLoading } = useAuth()

  if (loading || profileLoading || (session && !profile)) {
    return (
      <div className="flex h-full items-center justify-center bg-navy-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-navy-200 border-t-sunburst-500" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (profile?.app_role !== 'admin' || profile?.is_active === false) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
