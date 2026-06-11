import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import { parsePageRanges, chunkEveryN } from '../../core/pages'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, TextInput, SegmentedControl } from '../components/controls'
import { IconScissors } from '../icons'
import { downloadBytes, withSuffix } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import { toast } from '../toast'
import { t } from '../../strings/en'

type Mode = 'ranges' | 'everyN'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function SplitDialog({
  editor,
  fileName,
  onClose,
}: {
  editor: EditorDocument
  fileName: string
  onClose: () => void
}) {
  const total = editor.pageCount
  const [mode, setMode] = useState<Mode>('ranges')
  const [ranges, setRanges] = useState('1-' + total)
  const [everyN, setEveryN] = useState('1')
  const [busy, setBusy] = useState(false)

  const computeGroups = (): number[][] => {
    if (mode === 'everyN') {
      const n = parseInt(everyN, 10)
      return chunkEveryN(total, Number.isFinite(n) ? n : 1)
    }
    const groups: number[][] = []
    for (const seg of ranges.split(',')) {
      const s = seg.trim()
      if (!s) continue
      groups.push(parsePageRanges(s, total))
    }
    return groups.filter((g) => g.length)
  }

  const run = async () => {
    let groups: number[][]
    try {
      groups = computeGroups()
    } catch {
      toast.error(t.dialogs.split.invalidRanges.replace('{total}', String(total)))
      return
    }
    if (!groups.length) {
      toast.error(t.dialogs.split.invalidRanges.replace('{total}', String(total)))
      return
    }
    setBusy(true)
    try {
      const descriptorGroups = groups.map((g) => g.map((i) => editor.pages[i]))
      const parts = await editor.buildSplitGroups(descriptorGroups)
      for (let i = 0; i < parts.length; i++) {
        downloadBytes(parts[i], withSuffix(fileName, `-part${i + 1}`))
        await sleep(350) // give the browser time between downloads
      }
      toast.success(`${parts.length} ${t.common.pages.toLowerCase()}`)
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={t.dialogs.split.title}
      onClose={onClose}
      icon={<IconScissors size={18} />}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={run} disabled={busy}>
            {t.dialogs.split.splitButton}
          </Button>
        </>
      }
    >
      <Field label="">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'ranges', label: t.dialogs.split.byRanges },
            { value: 'everyN', label: t.dialogs.split.everyN },
          ]}
        />
      </Field>
      {mode === 'ranges' ? (
        <Field label={t.dialogs.split.rangesLabel}>
          <TextInput value={ranges} onInput={(e) => setRanges((e.target as HTMLInputElement).value)} />
        </Field>
      ) : (
        <Field label={t.dialogs.split.everyNLabel}>
          <TextInput
            type="number"
            min={1}
            max={total}
            value={everyN}
            onInput={(e) => setEveryN((e.target as HTMLInputElement).value)}
          />
        </Field>
      )}
      <p class="qt-hint">{t.dialogs.split.note}</p>
    </Dialog>
  )
}
