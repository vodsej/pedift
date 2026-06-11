import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import type { PageNumberPosition } from '../../core/types'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, Select, TextInput, SegmentedControl } from '../components/controls'
import { IconHash } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings/en'
import '../styles/docdialogs.css'

type RangeMode = 'all' | 'range'
type FormatOption = 'plain' | 'slash' | 'long'

const POSITION_OPTIONS: { value: PageNumberPosition; label: string }[] = [
  { value: 'top-left', label: t.dialogs.pageNumbers.topLeft },
  { value: 'top-center', label: t.dialogs.pageNumbers.topCenter },
  { value: 'top-right', label: t.dialogs.pageNumbers.topRight },
  { value: 'bottom-left', label: t.dialogs.pageNumbers.bottomLeft },
  { value: 'bottom-center', label: t.dialogs.pageNumbers.bottomCenter },
  { value: 'bottom-right', label: t.dialogs.pageNumbers.bottomRight },
]

const FORMAT_OPTIONS: { value: FormatOption; label: string }[] = [
  { value: 'plain', label: t.dialogs.pageNumbers.formatPlain },
  { value: 'slash', label: t.dialogs.pageNumbers.formatSlash },
  { value: 'long', label: t.dialogs.pageNumbers.formatLong },
]

export function PageNumbersDialog({
  editor,
  onClose,
}: {
  editor: EditorDocument
  onClose: () => void
}) {
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center')
  const [format, setFormat] = useState<FormatOption>('plain')
  const [startAt, setStartAt] = useState('1')
  const [rangeMode, setRangeMode] = useState<RangeMode>('all')
  const [fromPage, setFromPage] = useState('1')
  const [toPage, setToPage] = useState(String(editor.pageCount))

  const apply = () => {
    const range: [number, number] | null =
      rangeMode === 'range'
        ? [Math.max(0, parseInt(fromPage, 10) - 1), Math.max(0, parseInt(toPage, 10) - 1)]
        : null
    editor.setPageNumbers({
      position,
      format,
      startAt: Math.max(1, parseInt(startAt, 10) || 1),
      range,
      fontSize: 12,
      color: '#333333',
    })
    toast.success(t.dialogs.pageNumbers.title)
    onClose()
  }

  return (
    <Dialog
      title={t.dialogs.pageNumbers.title}
      onClose={onClose}
      icon={<IconHash size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={apply}>
            {t.dialogs.pageNumbers.addButton}
          </Button>
        </>
      }
    >
      <Field label={t.dialogs.pageNumbers.position}>
        <Select
          value={position}
          onChange={(v) => setPosition(v as PageNumberPosition)}
          options={POSITION_OPTIONS}
        />
      </Field>

      <Field label={t.dialogs.pageNumbers.format}>
        <Select
          value={format}
          onChange={(v) => setFormat(v as FormatOption)}
          options={FORMAT_OPTIONS}
        />
      </Field>

      <Field label={t.dialogs.pageNumbers.startAt}>
        <TextInput
          type="number"
          min={1}
          value={startAt}
          onInput={(e) => setStartAt((e.target as HTMLInputElement).value)}
          aria-label={t.dialogs.pageNumbers.startAt}
        />
      </Field>

      <Field label={t.dialogs.pageNumbers.range}>
        <SegmentedControl<RangeMode>
          value={rangeMode}
          onChange={setRangeMode}
          options={[
            { value: 'all', label: t.common.all },
            { value: 'range', label: t.dialogs.pageNumbers.range },
          ]}
        />
      </Field>

      {rangeMode === 'range' && (
        <div class="doc-field-grid">
          <Field label="From page">
            <TextInput
              type="number"
              min={1}
              max={editor.pageCount}
              value={fromPage}
              onInput={(e) => setFromPage((e.target as HTMLInputElement).value)}
              aria-label="From page"
            />
          </Field>
          <Field label="To page">
            <TextInput
              type="number"
              min={1}
              max={editor.pageCount}
              value={toPage}
              onInput={(e) => setToPage((e.target as HTMLInputElement).value)}
              aria-label="To page"
            />
          </Field>
        </div>
      )}
    </Dialog>
  )
}
