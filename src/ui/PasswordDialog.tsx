import { useRef, useEffect, useState } from 'preact/hooks'
import { Dialog } from './components/Dialog'
import { Button } from './components/Button'
import { IconLock } from './icons'
import { t } from '../strings'

interface Props {
  wrong: boolean
  onSubmit: (password: string) => void
  onCancel: () => void
}

export function PasswordDialog({ wrong, onSubmit, onCancel }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [emptyError, setEmptyError] = useState(false)
  const [showWrong, setShowWrong] = useState(wrong)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    setShowWrong(wrong)
  }, [wrong])

  const submit = (e: Event) => {
    e.preventDefault()
    const v = ref.current?.value ?? ''
    if (!v) { setEmptyError(true); return }
    onSubmit(v)
  }

  return (
    <Dialog
      title={t.errors.encrypted}
      onClose={onCancel}
      size="sm"
      icon={<IconLock size={18} />}
      footer={
        <>
          <Button onClick={onCancel}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={submit}>
            {t.errors.unlock}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <input
          ref={ref}
          class="input"
          type="password"
          placeholder={t.errors.passwordPrompt}
          autocomplete="off"
          aria-describedby={showWrong ? 'pw-error' : undefined}
          onInput={() => { setEmptyError(false); setShowWrong(false) }}
        />
        {emptyError && !showWrong && <p class="form-error">{t.dialogs.protect.empty}</p>}
        {showWrong && <p id="pw-error" class="form-error">{t.errors.wrongPassword}</p>}
      </form>
    </Dialog>
  )
}
