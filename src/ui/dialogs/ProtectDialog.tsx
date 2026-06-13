import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, TextInput, SegmentedControl } from '../components/controls'
import { IconLock } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import '../styles/docdialogs.css'

type Mode = 'addPassword' | 'removePassword'

export function ProtectDialog({
  editor,
  supported,
  onClose,
}: {
  editor: EditorDocument
  supported: boolean
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('addPassword')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const apply = () => {
    setError('')
    if (mode === 'addPassword') {
      if (!newPassword) {
        setError(t.dialogs.protect.empty)
        return
      }
      if (newPassword !== confirmPassword) {
        setError(t.dialogs.protect.mismatch)
        return
      }
      editor.setProtect({ userPassword: newPassword })
      toast.success(t.dialogs.protect.appliedAdd)
    } else {
      editor.setProtect(null)
      toast.success(t.dialogs.protect.appliedRemove)
    }
    onClose()
  }

  if (!supported) {
    return (
      <Dialog
        title={t.dialogs.protect.unsupportedTitle}
        onClose={onClose}
        icon={<IconLock size={18} />}
        footer={<Button onClick={onClose}>{t.common.close}</Button>}
      >
        <div class="doc-unsupported">
          {t.dialogs.protect.unsupported}
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      title={t.dialogs.protect.title}
      onClose={onClose}
      icon={<IconLock size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={apply}>
            {mode === 'addPassword'
              ? t.dialogs.protect.protectButton
              : t.dialogs.protect.unprotectButton}
          </Button>
        </>
      }
    >
      <Field label={t.dialogs.protect.mode} as="div">
        <SegmentedControl<Mode>
          value={mode}
          onChange={(m) => { setMode(m); setError('') }}
          ariaLabel={t.dialogs.protect.mode}
          options={[
            { value: 'addPassword', label: t.dialogs.protect.addPassword },
            { value: 'removePassword', label: t.dialogs.protect.removePassword },
          ]}
        />
      </Field>

      <p class="qt-hint">{t.dialogs.protect.saveNote}</p>

      {mode === 'addPassword' && (
        <div class="protect-pw">
          <Field label={t.dialogs.protect.newPassword}>
            <TextInput
              type="password"
              value={newPassword}
              onInput={(e) => { setNewPassword((e.target as HTMLInputElement).value); setError('') }}
              aria-label={t.dialogs.protect.newPassword}
              autofocus
            />
          </Field>
          <Field label={t.dialogs.protect.confirmPassword}>
            <TextInput
              type="password"
              value={confirmPassword}
              onInput={(e) => { setConfirmPassword((e.target as HTMLInputElement).value); setError('') }}
              aria-label={t.dialogs.protect.confirmPassword}
            />
          </Field>
          {error && <p class="doc-field-error" role="alert">{error}</p>}
        </div>
      )}
    </Dialog>
  )
}
