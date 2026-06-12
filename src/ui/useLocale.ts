import { useEffect, useReducer } from 'preact/hooks'
import { getLocale, setLocale, subscribeLocale, type Locale } from '../strings'

/**
 * Reactive locale state. Subscribing forces a re-render on every locale change;
 * placing this hook at the app root cascades fresh `t` reads through the tree.
 */
export function useLocale(): [Locale, (locale: Locale) => void] {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeLocale(() => bump(undefined)), [])
  return [getLocale(), setLocale]
}
