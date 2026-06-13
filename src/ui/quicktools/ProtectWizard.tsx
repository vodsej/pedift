import { useState } from 'preact/hooks'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { DropZone } from '../components/DropZone'
import { Field, TextInput, SegmentedControl } from '../components/controls'
import { Spinner } from '../components/Spinner'
import { IconFile, IconLock } from '../icons'
import { toast } from '../toast'
import { friendlyMessage } from '../../core/errors'
import { addPassword, removePassword } from '../../core/crypto'
import { fileToBytes, downloadBytes, formatBytes, withSuffix } from '../../io/fileio'
import { t } from '../../strings'
import '../styles/docdialogs.css'

type Mode = 'addPassword' | 'removePassword'

export function ProtectWizard({
  supported,
  onClose,
}: {
  supported: boolean
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<Mode>('addPassword')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFiles = (files: File[]) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setError('')
  }

  const clearError = () => setError('')

  const run = async () => {
    if (!file) return
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
    }

    setBusy(true)
    try {
      const bytes = await fileToBytes(file)
      if (mode === 'addPassword') {
        const result = await addPassword(bytes, { userPassword: newPassword })
        downloadBytes(result, withSuffix(file.name, '-protected'))
        toast.success(t.dialogs.protect.protectButton)
      } else {
        const result = await removePassword(bytes, currentPassword)
        downloadBytes(result, withSuffix(file.name, '-unlocked'))
        toast.success(t.dialogs.protect.unprotectButton)
      }
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
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

  const footer = busy ? (
    <Button onClick={onClose} disabled>{t.common.cancel}</Button>
  ) : (
    <>
      <Button onClick={onClose}>{t.common.cancel}</Button>
      <Button variant="primary" onClick={run} disabled={!file || busy}>
        {mode === 'addPassword'
          ? t.dialogs.protect.protectButton
          : t.dialogs.protect.unprotectButton}
      </Button>
    </>
  )

  return (
    <Dialog
      title={t.dialogs.protect.title}
      onClose={onClose}
      icon={<IconLock size={18} />}
      footer={footer}
    >
      {/* File picker */}
      {!file && !busy && (
        <DropZone accept="pdf" onFiles={handleFiles} compact activeLabel={t.landing.dropActive}>
          <span class="dropzone__icon">
            <IconFile size={28} />
          </span>
          <span class="dropzone__title">{t.dialogs.protect.pickFile}</span>
        </DropZone>
      )}

      {/* Selected file row */}
      {file && !busy && (
        <div class="doc-file-row">
          <span class="doc-file-row__icon">
            <IconLock size={18} />
          </span>
          <span class="doc-file-row__name">{file.name}</span>
          <span class="doc-file-row__size">{formatBytes(file.size)}</span>
        </div>
      )}

      {/* Busy state */}
      {busy && (
        <div class="qt-busy">
          <Spinner size={22} label={t.common.loading} />
        </div>
      )}

      {/* Mode + password fields — shown when file is selected and not busy */}
      {file && !busy && (
        <>
          <Field label={t.dialogs.protect.mode}>
            <SegmentedControl<Mode>
              value={mode}
              onChange={(m) => { setMode(m); clearError() }}
              options={[
                { value: 'addPassword', label: t.dialogs.protect.addPassword },
                { value: 'removePassword', label: t.dialogs.protect.removePassword },
              ]}
            />
          </Field>

          <div class="protect-pw">
            {mode === 'addPassword' && (
              <>
                <Field label={t.dialogs.protect.newPassword}>
                  <TextInput
                    type="password"
                    value={newPassword}
                    onInput={(e) => { setNewPassword((e.target as HTMLInputElement).value); clearError() }}
                    aria-label={t.dialogs.protect.newPassword}
                  />
                </Field>
                <Field label={t.dialogs.protect.confirmPassword}>
                  <TextInput
                    type="password"
                    value={confirmPassword}
                    onInput={(e) => { setConfirmPassword((e.target as HTMLInputElement).value); clearError() }}
                    aria-label={t.dialogs.protect.confirmPassword}
                  />
                </Field>
              </>
            )}
            {mode === 'removePassword' && (
              <Field label={t.dialogs.protect.currentPassword}>
                <TextInput
                  type="password"
                  value={currentPassword}
                  onInput={(e) => { setCurrentPassword((e.target as HTMLInputElement).value); clearError() }}
                  aria-label={t.dialogs.protect.currentPassword}
                />
              </Field>
            )}
            {error && <p class="doc-field-error" role="alert">{error}</p>}
          </div>
        </>
      )}
    </Dialog>
  )
}
