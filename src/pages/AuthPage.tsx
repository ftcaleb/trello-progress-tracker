import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return 'Incorrect email or password.'
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Please enter a valid email address.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email before logging in.'
  return message
}

type Mode = 'moodle' | 'email'

export function AuthPage() {
  const { session, signIn, signInWithMoodle } = useAuth()
  const location = useLocation()

  const [mode, setMode] = useState<Mode>('moodle')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setPassword('')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'moodle') {
      if (!username.trim()) return setError('Please enter your Moodle username.')
      if (!password) return setError('Please enter your Moodle password.')
    } else {
      if (!email.trim()) return setError('Please enter your email.')
      if (!password) return setError('Please enter your password.')
    }

    setSubmitting(true)
    try {
      if (mode === 'moodle') {
        await signInWithMoodle(username.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
      // On success the auth listener sets the session and this component
      // redirects via the <Navigate> above.
    } catch (err) {
      setError(
        friendlyError(err instanceof Error ? err.message : 'Something went wrong.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#0c1630] px-4 py-3 text-sm text-[#f2f5fc] outline-none transition placeholder:text-[#5f6b86] focus:border-[#c96fa2] focus:ring-4 focus:ring-[#c96fa2]/20'
  const labelClass =
    'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8b97b4]'

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        background:
          'radial-gradient(1100px 620px at 50% -12%, #17244c 0%, #0a1733 46%, #060e22 100%)',
      }}
    >
      {/* Pink ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-16 h-[26rem] w-[26rem] rounded-full bg-[#c96fa2]/10 blur-[130px]" />
        <div className="absolute -right-28 bottom-0 h-[24rem] w-[24rem] rounded-full bg-[#c96fa2]/[0.07] blur-[130px]" />
        {/* faint grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Brand wordmark above the card */}
        <div className="mb-7 flex justify-center">
          <img
            src="/logo-dark.png"
            alt="Melsoft Academy"
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Card */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-9"
          style={{
            background:
              'linear-gradient(180deg, #101c3d 0%, #0d1834 100%)',
            boxShadow:
              '0 40px 90px -30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Pink lamp accent — echoes the navbar */}
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
            <div className="h-[3px] w-20 rounded-b-full bg-[#c96fa2]" />
            <div className="absolute left-1/2 top-0 h-7 w-28 -translate-x-1/2 rounded-full bg-[#c96fa2]/30 blur-xl" />
          </div>

          {/* Mode toggle — segmented control */}
          <div className="mb-7 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#0b1428] p-1">
            {(
              [
                ['moodle', 'Moodle'],
                ['email', 'Administrator'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-full py-2 text-xs font-semibold transition focus:outline-none ${
                  mode === m
                    ? 'bg-[#c96fa2] text-[#1a0512] shadow-[0_4px_14px_-4px_rgba(201,111,162,0.6)]'
                    : 'text-[#8b97b4] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <h1 className="font-display text-[26px] font-bold leading-tight text-[#f2f5fc]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-[#8b97b4]">
            {mode === 'moodle'
              ? 'Sign in with your Moodle account to continue.'
              : 'Administrator email sign-in.'}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
            {mode === 'moodle' ? (
              <div>
                <label htmlFor="username" className={labelClass}>
                  Moodle username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your Moodle username"
                  className={inputClass}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className={labelClass}>
                {mode === 'moodle' ? 'Moodle password' : 'Password'}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-[#c96fa2]/30 bg-[#c96fa2]/10 px-4 py-3 text-sm text-[#f0c4dd]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c96fa2] px-4 py-3 text-sm font-bold text-[#1a0512] shadow-[0_10px_28px_-10px_rgba(201,111,162,0.7)] transition hover:bg-[#e19cc4] focus:outline-none focus:ring-4 focus:ring-[#c96fa2]/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a0512]/30 border-t-[#1a0512]" />
                  {mode === 'moodle' ? 'Checking with Moodle…' : 'Logging in…'}
                </>
              ) : mode === 'moodle' ? (
                'Sign in with Moodle'
              ) : (
                'Log in'
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-[#5f6b86]">
          Founder Institute cohort · Melsoft Academy
        </p>
      </div>
    </div>
  )
}
