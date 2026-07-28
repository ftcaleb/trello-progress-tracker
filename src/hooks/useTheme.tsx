import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'fi-theme'

type ThemeContextValue = {
  /** The resolved theme currently applied to the document. */
  theme: Theme
  /** True when the user has explicitly chosen a theme (persisted). */
  isExplicit: boolean
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.setAttribute('data-theme', 'light')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Honor an explicit stored choice; otherwise fall back to the OS setting.
  // Defaults to light when nothing is known, matching the app's prior look.
  const [stored, setStored] = useState<Theme | null>(() => readStored())
  const [system, setSystem] = useState<Theme>(() => systemTheme())

  const theme: Theme = stored ?? system

  // Keep in sync with the OS only while the user hasn't chosen explicitly.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  // Apply the resolved theme to the document.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setStored(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* storage unavailable — theme still applies for the session */
    }
  }, [])

  const toggle = useCallback(() => {
    setStored((prev) => {
      const next: Theme = (prev ?? systemTheme()) === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* noop */
      }
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isExplicit: stored !== null, setTheme, toggle }),
    [theme, stored, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
