/*
 * Locale registry and the active string table.
 *
 * Components import `t` from here (not from `./en`). `t` is a live binding that
 * `setLocale` reassigns, so any code reading `t.x.y` during render picks up the
 * new locale — a single forced re-render at the app root cascades the change
 * through the whole tree (see `src/ui/useLocale.ts`).
 *
 * This module deliberately avoids importing Preact or touching the DOM eagerly:
 * it is a leaf imported by every layer (including `core`), so web APIs are
 * accessed only behind `typeof` guards, keeping it safe under Node tests.
 */

import { en, type Strings } from './en'
import { cs } from './cs'

export type { Strings }
export type Locale = 'en' | 'cs'

/** Selectable locales, in display order. */
export const LOCALES: readonly Locale[] = ['en', 'cs']

const tables: Record<Locale, Strings> = { en, cs }

const STORAGE_KEY = 'pedift.lang'

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'cs'
}

/** Stored choice wins; otherwise fall back to the browser's preferred languages. */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* localStorage may be unavailable from file:// in some browsers */
  }
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    const langs = nav?.languages?.length ? nav.languages : nav ? [nav.language] : []
    for (const lang of langs) {
      if (lang?.toLowerCase().startsWith('cs')) return 'cs'
    }
  } catch {
    /* navigator may be absent (e.g. Node) */
  }
  return 'en'
}

let current: Locale = detectLocale()

/** The active string table. Reassigned by `setLocale` (a live ES binding). */
export let t: Strings = tables[current]

const subscribers = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

/** Switch the active locale, persist the choice, and notify subscribers. */
export function setLocale(locale: Locale): void {
  if (locale === current) return
  current = locale
  t = tables[locale]
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  applyDocumentLang(locale)
  subscribers.forEach((fn) => fn())
}

/** Register a callback fired after every locale change. Returns an unsubscribe. */
export function subscribeLocale(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

function applyDocumentLang(locale: Locale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
}

// Reflect the initial locale on <html lang> as soon as this module loads.
applyDocumentLang(current)
