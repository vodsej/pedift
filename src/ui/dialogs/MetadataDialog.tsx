import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, TextInput } from '../components/controls'
import { IconInfo } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import '../styles/docdialogs.css'

export function MetadataDialog({
  editor,
  onClose,
}: {
  editor: EditorDocument
  onClose: () => void
}) {
  const meta = editor.state.metadata
  const [title, setTitle] = useState(meta.title)
  const [author, setAuthor] = useState(meta.author)
  const [subject, setSubject] = useState(meta.subject)
  const [keywords, setKeywords] = useState(meta.keywords)

  const apply = () => {
    editor.setMetadata({ title, author, subject, keywords })
    toast.success(t.common.apply)
    onClose()
  }

  return (
    <Dialog
      title={t.dialogs.metadata.title}
      onClose={onClose}
      icon={<IconInfo size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={apply}>
            {t.dialogs.metadata.saveButton}
          </Button>
        </>
      }
    >
      <Field label={t.dialogs.metadata.titleField}>
        <TextInput
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          aria-label={t.dialogs.metadata.titleField}
        />
      </Field>
      <Field label={t.dialogs.metadata.author}>
        <TextInput
          value={author}
          onInput={(e) => setAuthor((e.target as HTMLInputElement).value)}
          aria-label={t.dialogs.metadata.author}
        />
      </Field>
      <Field label={t.dialogs.metadata.subject}>
        <TextInput
          value={subject}
          onInput={(e) => setSubject((e.target as HTMLInputElement).value)}
          aria-label={t.dialogs.metadata.subject}
        />
      </Field>
      <Field label={t.dialogs.metadata.keywords}>
        <TextInput
          value={keywords}
          onInput={(e) => setKeywords((e.target as HTMLInputElement).value)}
          aria-label={t.dialogs.metadata.keywords}
        />
      </Field>
    </Dialog>
  )
}
