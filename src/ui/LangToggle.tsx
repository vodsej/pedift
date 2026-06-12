import { IconButton } from './components/Button'
import { t, type Locale } from '../strings'

/** Toggles between the available locales, showing the active one's code. */
export function LangToggle({
  locale,
  onSelect,
}: {
  locale: Locale
  onSelect: (locale: Locale) => void
}) {
  const next: Locale = locale === 'en' ? 'cs' : 'en'
  return (
    <IconButton
      label={t.language.switchTo}
      onClick={() => onSelect(next)}
      class="langtoggle"
    >
      <span class="langtoggle__code">{locale.toUpperCase()}</span>
    </IconButton>
  )
}
