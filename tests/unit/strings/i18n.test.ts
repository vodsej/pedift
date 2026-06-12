import { describe, it, expect, beforeEach } from 'vitest'
import { en } from '../../../src/strings/en'
import { cs } from '../../../src/strings/cs'
import * as i18n from '../../../src/strings'

/**
 * Locale registry. The most load-bearing guarantee here is that `t` is a live
 * ES binding: reassigning it in `setLocale` must be observable through the
 * already-imported `i18n.t`, because every component reads `t.x.y` at render
 * time and relies on that read seeing the active locale.
 */
describe('i18n locale registry', () => {
  beforeEach(() => {
    i18n.setLocale('en')
  })

  it('starts on a known locale with a matching table', () => {
    expect(['en', 'cs']).toContain(i18n.getLocale())
    expect(i18n.t.appName).toBe('pedift')
  })

  it('swaps the live `t` binding when the locale changes', () => {
    i18n.setLocale('cs')
    expect(i18n.getLocale()).toBe('cs')
    expect(i18n.t.tools.select).toBe(cs.tools.select)
    expect(i18n.t.tools.select).not.toBe(en.tools.select)

    i18n.setLocale('en')
    expect(i18n.t.tools.select).toBe(en.tools.select)
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    let calls = 0
    const unsubscribe = i18n.subscribeLocale(() => {
      calls++
    })

    i18n.setLocale('cs')
    expect(calls).toBe(1)

    // Setting the same locale is a no-op and must not notify.
    i18n.setLocale('cs')
    expect(calls).toBe(1)

    unsubscribe()
    i18n.setLocale('en')
    expect(calls).toBe(1)
  })

  it('exposes the selectable locales', () => {
    expect([...i18n.LOCALES]).toEqual(['en', 'cs'])
  })
})

/**
 * Structural parity: the Czech table must cover exactly the same keys (and the
 * same value kinds) as the English one, so no string silently falls back or
 * goes missing. The `Strings` type already enforces this at build time; this
 * test is a runtime backstop and a guard for future locales.
 */
describe('locale table parity', () => {
  type Json = unknown

  function shape(value: Json): Json {
    if (typeof value === 'function') return 'function'
    if (value && typeof value === 'object') {
      const out: Record<string, Json> = {}
      for (const key of Object.keys(value as object).sort()) {
        out[key] = shape((value as Record<string, Json>)[key])
      }
      return out
    }
    return 'string'
  }

  it('cs mirrors en key-for-key', () => {
    expect(shape(cs)).toEqual(shape(en))
  })

  it('interpolating functions produce non-empty Czech strings', () => {
    expect(cs.workspace.pageOf(2, 5)).toContain('2')
    expect(cs.workspace.pageOf(2, 5)).toContain('5')
    expect(cs.pagesPanel.deleteConfirm(1)).not.toBe(cs.pagesPanel.deleteConfirm(3))
    expect(cs.toasts.pagesDeleted(1)).toContain('1')
    expect(cs.toasts.pagesDeleted(5)).toContain('5')
  })
})
