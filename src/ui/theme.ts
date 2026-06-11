import { useEffect, useState } from 'preact/hooks'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pedift.theme'

/** Resolve the theme to apply: explicit stored choice, else the OS preference. */
export function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* localStorage may be unavailable from file:// in some browsers */
  }
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

/** Reactive theme state for components; persists and applies on change. */
export function useTheme(): [Theme, () => void, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (t: Theme) => {
    storeTheme(t)
    setThemeState(t)
  }
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return [theme, toggle, setTheme]
}
