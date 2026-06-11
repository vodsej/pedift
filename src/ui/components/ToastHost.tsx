import { useToasts, dismissToast } from '../toast'
import { IconCheck, IconAlert, IconInfo, IconClose } from '../icons'
import { t } from '../../strings/en'

export function ToastHost() {
  const toasts = useToasts()
  return (
    <div class="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} class={`toast toast--${toast.kind}`}>
          <span class="toast__icon">
            {toast.kind === 'success' ? (
              <IconCheck size={18} />
            ) : toast.kind === 'error' ? (
              <IconAlert size={18} />
            ) : (
              <IconInfo size={18} />
            )}
          </span>
          <span class="toast__msg">{toast.message}</span>
          <button class="toast__close" onClick={() => dismissToast(toast.id)} aria-label={t.common.dismiss}>
            <IconClose size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
