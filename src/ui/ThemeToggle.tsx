import { IconButton } from './components/Button'
import { IconSun, IconMoon } from './icons'
import type { Theme } from './theme'
import { t } from '../strings/en'

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark'
  return (
    <IconButton label={dark ? t.theme.toLight : t.theme.toDark} onClick={onToggle}>
      {dark ? <IconSun /> : <IconMoon />}
    </IconButton>
  )
}
