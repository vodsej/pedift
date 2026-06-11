import { Dialog } from './Dialog'
import { Button } from './Button'
import { IconAlert } from '../icons'
import { t } from '../../strings/en'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = t.common.confirm,
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      size="sm"
      icon={<IconAlert size={18} />}
      footer={
        <>
          <Button onClick={onCancel}>{t.common.cancel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Dialog>
  )
}
