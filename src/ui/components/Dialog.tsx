import { useEffect, useRef } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { IconButton } from './Button'
import { IconClose } from '../icons'
import { t } from '../../strings'

interface DialogProps {
  title: string
  onClose: () => void
  children: ComponentChildren
  footer?: ComponentChildren
  /** Max content width preset. */
  size?: 'sm' | 'md' | 'lg'
  icon?: ComponentChildren
  /** While true the dialog refuses to dismiss (Escape, backdrop, ✕) — used to
   *  protect an irreversible async operation that is in flight. */
  locked?: boolean
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ title, onClose, children, footer, size = 'md', icon, locked = false }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Read the latest props from inside the once-on-mount effect without retriggering it.
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    // Remember who opened us so focus can return there on close (WCAG 2.4.3).
    const trigger = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!lockedRef.current) onCloseRef.current()
        return
      }
      // Trap Tab focus inside the modal (WCAG 2.1.2).
      if (e.key === 'Tab' && ref.current) {
        const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        )
        if (focusable.length === 0) {
          e.preventDefault()
          ref.current.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // focus the dialog for keyboard users
    ref.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      trigger?.focus?.()
    }
  }, [])

  return (
    <div
      class="modal-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}
    >
      <div
        ref={ref}
        class={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header class="modal__head">
          <h2 class="modal__title">
            {icon && <span class="modal__icon">{icon}</span>}
            {title}
          </h2>
          <IconButton label={t.common.close} onClick={onClose} disabled={locked}>
            <IconClose />
          </IconButton>
        </header>
        <div class="modal__body">{children}</div>
        {footer && <footer class="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}
