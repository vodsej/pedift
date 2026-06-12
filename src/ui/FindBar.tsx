import { useEffect, useRef } from 'preact/hooks'
import { IconButton } from './components/Button'
import { IconSearch, IconChevronUp, IconChevronDown, IconClose } from './icons'
import type { SearchApi } from './hooks/useSearch'
import { t } from '../strings'

/** Floating Ctrl+F find bar: query input, match counter, prev/next, close. */
export function FindBar({ search }: { search: SearchApi }) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus (and select existing text) whenever the bar is opened or re-triggered.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [search.focusNonce])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) search.prev()
      else search.next()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      search.setOpen(false)
    }
  }

  const hasQuery = search.effectiveQuery.length > 0
  const total = search.matches.length
  const counter = !hasQuery
    ? ''
    : search.busy
      ? '…'
      : total === 0
        ? t.find.noResults
        : t.find.counter(search.active + 1, total)

  return (
    <div class="find-bar" role="search">
      <IconSearch size={16} class="find-bar__icon" />
      <input
        ref={inputRef}
        class="find-bar__input"
        type="text"
        placeholder={t.find.placeholder}
        value={search.query}
        onInput={(e) => search.setQuery((e.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown}
      />
      <span class={`find-bar__count${hasQuery && total === 0 && !search.busy ? ' is-empty' : ''}`}>
        {counter}
      </span>
      <span class="find-bar__divider" />
      <IconButton label={t.find.previous} onClick={search.prev} disabled={total === 0}>
        <IconChevronUp size={18} />
      </IconButton>
      <IconButton label={t.find.next} onClick={search.next} disabled={total === 0}>
        <IconChevronDown size={18} />
      </IconButton>
      <IconButton label={t.find.close} onClick={() => search.setOpen(false)}>
        <IconClose size={18} />
      </IconButton>
    </div>
  )
}
