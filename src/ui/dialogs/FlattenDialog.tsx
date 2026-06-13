import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import type { RenderRegistry } from '../../render/registry'
import { flattenDocument } from '../../core/forms'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { IconCheck } from '../icons'
import { toast } from '../toast'
import { friendlyMessage } from '../../core/errors'
import { t } from '../../strings'
import '../styles/docdialogs.css'

export function FlattenDialog({
  editor,
  registry,
  onClose,
}: {
  editor: EditorDocument
  registry: RenderRegistry
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  const flatten = async () => {
    const source = editor.getSource('original')
    if (!source) return
    setBusy(true)
    try {
      const result = await flattenDocument(source.bytes, source.password)
      await editor.rebase(result)
      await registry.evict('original')
      toast.success(t.dialogs.flatten.applied)
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={t.dialogs.flatten.title}
      onClose={onClose}
      locked={busy}
      icon={<IconCheck size={18} />}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={flatten} disabled={busy}>
            {t.dialogs.flatten.flattenButton}
          </Button>
        </>
      }
    >
      <p class="qt-hint">{t.dialogs.flatten.hint}</p>
    </Dialog>
  )
}
