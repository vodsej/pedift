import { useEffect, useRef } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { IconButton } from './Button'
import { IconClose } from '../icons'

interface DialogProps {
  title: string
  onClose: () => void
  children: ComponentChildren
  footer?: ComponentChildren
  /** Max content width preset. */
  size?: 'sm' | 'md' | 'lg'
  icon?: ComponentChildren
}

export function Dialog({ title, onClose, children, footer, size = 'md', icon }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // focus the dialog for keyboard users
    ref.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div class="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
          <IconButton label="Close" onClick={onClose}>
            <IconClose />
          </IconButton>
        </header>
        <div class="modal__body">{children}</div>
        {footer && <footer class="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}
