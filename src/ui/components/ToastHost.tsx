import { useToasts, dismissToast } from '../toast'
import { IconCheck, IconAlert, IconInfo, IconClose } from '../icons'

export function ToastHost() {
  const toasts = useToasts()
  return (
    <div class="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={`toast toast--${t.kind}`}>
          <span class="toast__icon">
            {t.kind === 'success' ? (
              <IconCheck size={18} />
            ) : t.kind === 'error' ? (
              <IconAlert size={18} />
            ) : (
              <IconInfo size={18} />
            )}
          </span>
          <span class="toast__msg">{t.message}</span>
          <button class="toast__close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <IconClose size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
