import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import type { RenderRegistry } from '../../render/registry'
import { descriptorToImageBlob, type ImageFormat } from '../../render/exportImage'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, SegmentedControl, Select } from '../components/controls'
import { IconImage } from '../icons'
import { downloadBlob, withSuffix } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import { toast } from '../toast'
import { t } from '../../strings/en'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function ExportImageDialog({
  editor,
  registry,
  ids,
  fileName,
  onClose,
}: {
  editor: EditorDocument
  registry: RenderRegistry
  ids: string[]
  fileName: string
  onClose: () => void
}) {
  const [format, setFormat] = useState<ImageFormat>('png')
  const [scale, setScale] = useState('2')
  const [busy, setBusy] = useState(false)

  // Export selected pages, or the whole document if nothing is selected.
  const targets = ids.length ? editor.pages.filter((p) => ids.includes(p.id)) : editor.pages

  const run = async () => {
    setBusy(true)
    try {
      const s = parseInt(scale, 10)
      for (let i = 0; i < targets.length; i++) {
        const blob = await descriptorToImageBlob(registry, targets[i], format, s)
        const pageNo = editor.pages.findIndex((p) => p.id === targets[i].id) + 1
        downloadBlob(blob, withSuffix(fileName, `-p${pageNo}`, format === 'png' ? '.png' : '.jpg'))
        await sleep(300)
      }
      toast.success(`${targets.length} ${t.common.pages.toLowerCase()}`)
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={t.dialogs.exportImage.title}
      onClose={onClose}
      icon={<IconImage size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={run} disabled={busy || targets.length === 0}>
            {t.dialogs.exportImage.exportButton}
          </Button>
        </>
      }
    >
      <Field label={t.dialogs.exportImage.format}>
        <SegmentedControl<ImageFormat>
          value={format}
          onChange={setFormat}
          options={[
            { value: 'png', label: t.dialogs.exportImage.png },
            { value: 'jpg', label: t.dialogs.exportImage.jpg },
          ]}
        />
      </Field>
      <Field label={t.dialogs.exportImage.scale}>
        <Select
          value={scale}
          onChange={setScale}
          options={[
            { value: '1', label: t.dialogs.exportImage.scale1x },
            { value: '2', label: t.dialogs.exportImage.scale2x },
            { value: '3', label: t.dialogs.exportImage.scale3x },
            { value: '4', label: t.dialogs.exportImage.scale4x },
          ]}
        />
      </Field>
      <p class="qt-hint">
        {targets.length} {t.common.pages.toLowerCase()}
      </p>
    </Dialog>
  )
}
