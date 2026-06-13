import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, TextInput, Slider, ColorInput, SegmentedControl } from '../components/controls'
import { IconWatermark } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import '../styles/docdialogs.css'

type RangeMode = 'all' | 'range'

export function WatermarkDialog({
  editor,
  onClose,
}: {
  editor: EditorDocument
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [color, setColor] = useState('#ff0000')
  const [opacity, setOpacity] = useState(15) // displayed as 0-100, stored /100
  const [rangeMode, setRangeMode] = useState<RangeMode>('all')
  const [fromPage, setFromPage] = useState('1')
  const [toPage, setToPage] = useState(String(editor.pageCount))

  const apply = () => {
    if (rangeMode === 'range') {
      const from = parseInt(fromPage, 10)
      const to = parseInt(toPage, 10)
      if (isNaN(from) || isNaN(to) || from > to || from < 1 || to > editor.pageCount) {
        toast.error(t.common.invalidRange)
        return
      }
    }
    const range: [number, number] | null =
      rangeMode === 'range'
        ? [Math.max(0, parseInt(fromPage, 10) - 1), Math.max(0, parseInt(toPage, 10) - 1)]
        : null
    editor.setWatermark({ text, color, opacity: opacity / 100, fontSize: 48, range })
    toast.success(t.dialogs.watermark.applied)
    onClose()
  }

  return (
    <Dialog
      title={t.dialogs.watermark.title}
      onClose={onClose}
      icon={<IconWatermark size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={apply} disabled={text.trim() === ''}>
            {t.dialogs.watermark.addButton}
          </Button>
        </>
      }
    >
      <Field label={t.dialogs.watermark.text}>
        <TextInput
          value={text}
          placeholder={t.dialogs.watermark.placeholder}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          aria-label={t.dialogs.watermark.text}
          autofocus
        />
      </Field>

      <Field label={t.tools.color}>
        <div class="doc-color-row">
          <ColorInput value={color} onChange={setColor} />
        </div>
      </Field>

      <Field label={t.tools.opacity}>
        <div class="doc-slider-row">
          <Slider
            value={opacity}
            min={0}
            max={100}
            step={1}
            onInput={setOpacity}
          />
          <span class="doc-slider-val">{opacity}%</span>
        </div>
      </Field>

      <Field label={t.dialogs.watermark.applyTo} as="div">
        <SegmentedControl<RangeMode>
          value={rangeMode}
          onChange={setRangeMode}
          ariaLabel={t.dialogs.watermark.applyTo}
          options={[
            { value: 'all', label: t.common.all },
            { value: 'range', label: t.common.range },
          ]}
        />
      </Field>

      {rangeMode === 'range' && (
        <div class="doc-field-grid">
          <Field label={t.common.fromPage}>
            <TextInput
              type="number"
              min={1}
              max={editor.pageCount}
              value={fromPage}
              onInput={(e) => setFromPage((e.target as HTMLInputElement).value)}
              aria-label={t.common.fromPage}
            />
          </Field>
          <Field label={t.common.toPage}>
            <TextInput
              type="number"
              min={1}
              max={editor.pageCount}
              value={toPage}
              onInput={(e) => setToPage((e.target as HTMLInputElement).value)}
              aria-label={t.common.toPage}
            />
          </Field>
        </div>
      )}
    </Dialog>
  )
}
