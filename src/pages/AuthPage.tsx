import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import logoDark from '../assets/logo-dark.png'

function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return 'Incorrect email or password.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try logging in.'
  if (m.includes('password should be at least') || m.includes('weak'))
    return 'Password must be at least 6 characters.'
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Please enter a valid email address.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email before logging in.'
  return message
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { session, signIn, signUp } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  const isSignup = mode === 'signup'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) return setError('Please enter your email.')
    if (!password) return setError('Please enter your password.')
    if (isSignup && password.length < 6)
      return setError('Password must be at least 6 characters.')

    setSubmitting(true)
    try {
      if (isSignup) await signUp(email.trim(), password)
      else await signIn(email.trim(), password)
      // On success the auth listener sets the session and this component
      // redirects via the <Navigate> above.
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Something went wrong.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
      {/* Ambient gradient shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-sunburst-500/30 to-maroon-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-maroon-600/30 to-sunburst-500/10 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-modal md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-maroon-600 via-maroon-700 to-navy-900 p-10 text-white md:flex">
          <img src={logoDark} alt="FI Project Tracker" className="h-11 w-auto" />
          <div>
            <h2 className="text-2xl font-extrabold leading-snug">
              Track every startup, phase by phase.
            </h2>
            <p className="mt-3 text-sm text-white/70">
              A shared board for the Founder Institute cohort — deliverables,
              phase gates, and standups in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-sunburst-500" />
            13 projects · 4 weekly phases each
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sunburst-500 text-base font-black text-navy-900">
              FI
            </div>
            <span className="text-base font-bold text-navy-900">
              FI Project Tracker
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-navy-900">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-navy-400">
            {isSignup
              ? 'Sign up to start tracking your cohort.'
              : 'Log in to your project tracker.'}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-navy-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-navy-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
                className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-sunburst-500 focus:ring-4 focus:ring-sunburst-500/15"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-sunburst-200 bg-sunburst-50 px-3.5 py-2.5 text-sm text-sunburst-800">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sunburst-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sunburst-600 focus:ring-4 focus:ring-sunburst-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {isSignup ? 'Creating account…' : 'Logging in…'}
                </>
              ) : isSignup ? (
                'Create account'
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-400">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-maroon-600 hover:text-maroon-700 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                New to the tracker?{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-maroon-600 hover:text-maroon-700 hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
