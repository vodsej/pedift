import { useEffect, useRef, useState } from 'preact/hooks'
import fontkit from '@pdf-lib/fontkit'
import type { EditorDocument } from '../../core/document'
import type { RenderRegistry } from '../../render/registry'
import { recognizePage, isScannedPage, getOcrFont, type OcrLang } from '../../ocr/engine'
import { parsePageRanges } from '../../core/pages'
import type { OcrPageData } from '../../core/types'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, TextInput } from '../components/controls'
import { IconOcr } from '../icons'
import { toast } from '../toast'
import { friendlyMessage } from '../../core/errors'
import { t } from '../../strings'
import '../styles/docdialogs.css'
import '../styles/ocr.css'

type Scope = 'all' | 'scanned' | 'range'

export function OcrDialog({
  editor,
  registry,
  onClose,
}: {
  editor: EditorDocument
  registry: RenderRegistry
  onClose: () => void
}) {
  const [lang, setLang] = useState<OcrLang>('eng')
  const [scope, setScope] = useState<Scope>('scanned')
  const [rangeInput, setRangeInput] = useState('')
  const [scannedIds, setScannedIds] = useState<Set<string> | null>(null)
  const [detecting, setDetecting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const cancelRef = useRef(false)

  // Detect scanned pages on mount.
  useEffect(() => {
    let alive = true
    const detect = async () => {
      const ids = new Set<string>()
      for (const pd of editor.pages) {
        if (!alive) break
        const scanned = await isScannedPage(registry, pd)
        if (scanned) ids.add(pd.id)
      }
      if (!alive) return
      setScannedIds(ids)
      setDetecting(false)
      setScope(ids.size > 0 ? 'scanned' : 'all')
    }
    void detect()
    return () => {
      alive = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveTargetPages = (): typeof editor.pages => {
    if (scope === 'all') return editor.pages
    if (scope === 'scanned') return editor.pages.filter((pd) => scannedIds?.has(pd.id))
    // range — parse 1-based input
    const total = editor.pages.length
    const indices = parsePageRanges(rangeInput, total)
    return indices.map((i) => editor.pages[i])
  }

  const run = async () => {
    let targets: typeof editor.pages
    try {
      targets = resolveTargetPages()
    } catch {
      toast.error(t.dialogs.ocr.noPages)
      return
    }
    if (!targets.length) {
      toast.error(t.dialogs.ocr.noPages)
      return
    }

    cancelRef.current = false
    setCancelling(false)
    setBusy(true)
    setProgress({ current: 0, total: targets.length })

    const collected: Record<string, OcrPageData> = {}
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) {
          // Loop exited via cancellation — close automatically.
          onClose()
          return
        }
        setProgress({ current: i + 1, total: targets.length })
        const pd = targets[i]
        const data = await recognizePage(registry, pd, lang)
        collected[pd.id] = data
        // Yield between pages so the UI repaints.
        await new Promise<void>((r) => setTimeout(r, 0))
      }

      const fontBytes = await getOcrFont()
      editor.setOcrData(collected, fontBytes, fontkit)
      toast.success(t.dialogs.ocr.done(targets.length))
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
      setCancelling(false)
      setProgress(null)
    }
  }

  const cancel = () => {
    if (busy) {
      cancelRef.current = true
      setCancelling(true)
    } else {
      onClose()
    }
  }

  const scannedCount = scannedIds?.size ?? 0
  const total = editor.pages.length

  return (
    <Dialog
      title={t.dialogs.ocr.title}
      onClose={busy ? cancel : onClose}
      icon={<IconOcr size={18} />}
      footer={
        <>
          <Button onClick={cancel}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={run} disabled={busy || detecting}>
            {t.dialogs.ocr.run}
          </Button>
        </>
      }
    >
      <p class="qt-hint">{t.dialogs.ocr.hint}</p>

      {detecting ? (
        <p class="qt-hint">{t.dialogs.ocr.detecting}</p>
      ) : (
        <>
          <Field label={t.dialogs.ocr.language} as="div">
            <div class="ocr-radio-group">
              <label class="ocr-radio-label">
                <input
                  type="radio"
                  name="ocr-lang"
                  value="eng"
                  checked={lang === 'eng'}
                  disabled={busy}
                  onChange={() => setLang('eng')}
                />
                {t.dialogs.ocr.english}
              </label>
              <label class="ocr-radio-label">
                <input
                  type="radio"
                  name="ocr-lang"
                  value="ces"
                  checked={lang === 'ces'}
                  disabled={busy}
                  onChange={() => setLang('ces')}
                />
                {t.dialogs.ocr.czech}
              </label>
            </div>
          </Field>

          <Field label={t.dialogs.ocr.scope} as="div">
            <div class="ocr-radio-group">
              <label class="ocr-radio-label">
                <input
                  type="radio"
                  name="ocr-scope"
                  value="all"
                  checked={scope === 'all'}
                  disabled={busy}
                  onChange={() => setScope('all')}
                />
                {t.dialogs.ocr.scopeAll}
              </label>
              <label class="ocr-radio-label">
                <input
                  type="radio"
                  name="ocr-scope"
                  value="scanned"
                  checked={scope === 'scanned'}
                  disabled={busy || scannedCount === 0}
                  onChange={() => setScope('scanned')}
                />
                {t.dialogs.ocr.scopeScanned.replace('{count}', String(scannedCount))}
              </label>
              {scannedCount === 0 && (
                <p class="qt-hint">{t.dialogs.ocr.allHaveText}</p>
              )}
              <label class="ocr-radio-label">
                <input
                  type="radio"
                  name="ocr-scope"
                  value="range"
                  checked={scope === 'range'}
                  disabled={busy}
                  onChange={() => setScope('range')}
                />
                {t.dialogs.ocr.scopeRange}
              </label>
            </div>
          </Field>

          {scope === 'range' && (
            <Field label={t.dialogs.ocr.rangeLabel}>
              <TextInput
                value={rangeInput}
                placeholder={`1-${total}`}
                disabled={busy}
                autofocus
                onInput={(e) => setRangeInput((e.target as HTMLInputElement).value)}
              />
            </Field>
          )}
        </>
      )}

      {progress && (
        <div class="ocr-progress">
          <span class="ocr-progress__label">
            {cancelling
              ? t.dialogs.ocr.cancelling
              : t.dialogs.ocr.progress
                  .replace('{current}', String(progress.current))
                  .replace('{total}', String(progress.total))}
          </span>
          <div
            class="ocr-progress__bar-track"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              class="ocr-progress__bar-fill"
              style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </Dialog>
  )
}
