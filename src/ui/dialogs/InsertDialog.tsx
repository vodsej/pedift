import { useState } from 'preact/hooks'
import { PDFDocument } from '@cantoo/pdf-lib'
import type { EditorDocument } from '../../core/document'
import { parsePageRanges } from '../../core/pages'
import { nextId } from '../../core/ids'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { DropZone } from '../components/DropZone'
import { Field, TextInput, Select, SegmentedControl } from '../components/controls'
import { Spinner } from '../components/Spinner'
import { IconInsert, IconFile } from '../icons'
import { fileToBytes, formatBytes } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import { toast } from '../toast'
import { t } from '../../strings/en'

type Which = 'all' | 'some'

export function InsertDialog({
  editor,
  onClose,
  insertAfter,
}: {
  editor: EditorDocument
  onClose: () => void
  insertAfter: string | null
}) {
  const total = editor.pageCount
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; count: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [which, setWhich] = useState<Which>('all')
  const [someRanges, setSomeRanges] = useState('')
  // Default position: right after the current page.
  const afterIndex = insertAfter ? editor.indexOfPage(insertAfter) : total - 1
  const [position, setPosition] = useState(String(afterIndex + 1)) // 0..total (insertion index)
  const [busy, setBusy] = useState(false)

  const loadFile = async (f: File) => {
    setLoading(true)
    try {
      const bytes = await fileToBytes(f)
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      setFile({ name: f.name, bytes, count: doc.getPageCount() })
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const run = () => {
    if (!file) return
    let indices: number[]
    try {
      indices =
        which === 'all'
          ? Array.from({ length: file.count }, (_, i) => i)
          : parsePageRanges(someRanges, file.count)
    } catch {
      toast.error(t.dialogs.split.invalidRanges.replace('{total}', String(file.count)))
      return
    }
    if (!indices.length) return
    setBusy(true)
    const sourceId = nextId('src')
    editor.addSource({ id: sourceId, kind: 'pdf', bytes: file.bytes, name: file.name })
    editor.insertSourcePages(sourceId, indices, parseInt(position, 10))
    toast.success(`${indices.length} ${t.common.pages.toLowerCase()}`)
    onClose()
  }

  const positionOptions = [
    ...Array.from({ length: total }, (_, i) => ({
      value: String(i),
      label: t.dialogs.insert.beforePage(i + 1),
    })),
    { value: String(total), label: t.dialogs.insert.atEnd },
  ]

  return (
    <Dialog
      title={t.dialogs.insert.title}
      onClose={onClose}
      icon={<IconInsert size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={run} disabled={!file || busy}>
            {t.dialogs.insert.insertButton}
          </Button>
        </>
      }
    >
      {!file ? (
        <DropZone accept="pdf" onFiles={(fs) => fs[0] && loadFile(fs[0])} compact>
          {loading ? (
            <Spinner size={28} label={t.common.loading} />
          ) : (
            <>
              <span class="dropzone__icon">
                <IconFile size={28} />
              </span>
              <span class="dropzone__title">{t.dialogs.insert.pickFile}</span>
            </>
          )}
        </DropZone>
      ) : (
        <>
          <div class="qt-row">
            <span class="qt-file-icon">
              <IconFile size={18} />
            </span>
            <span class="qt-row__name">{file.name}</span>
            <span class="qt-row__size">
              {file.count} {t.common.pages.toLowerCase()} · {formatBytes(file.bytes.length)}
            </span>
          </div>

          <Field label={t.dialogs.insert.whichPages}>
            <SegmentedControl<Which>
              value={which}
              onChange={setWhich}
              options={[
                { value: 'all', label: t.dialogs.insert.allPages },
                { value: 'some', label: t.dialogs.insert.somePages },
              ]}
            />
          </Field>
          {which === 'some' && (
            <Field label={t.dialogs.insert.somePages}>
              <TextInput
                placeholder="1-3, 5"
                value={someRanges}
                onInput={(e) => setSomeRanges((e.target as HTMLInputElement).value)}
              />
            </Field>
          )}

          <Field label={t.dialogs.insert.position}>
            <Select value={position} onChange={setPosition} options={positionOptions} />
          </Field>
        </>
      )}
    </Dialog>
  )
}
