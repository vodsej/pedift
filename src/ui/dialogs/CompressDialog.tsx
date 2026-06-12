import '../styles/compress.css'
import { useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Field, Slider } from '../components/controls'
import { Spinner } from '../components/Spinner'
import { IconCompress, IconDownload } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import { compressPdf } from '../../core/compress'
import { downloadBytes, formatBytes, withSuffix } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import type { CompressResult } from '../../core/compress'

export function CompressDialog({
  editor,
  onClose,
}: {
  editor: EditorDocument
  onClose: () => void
}) {
  const [quality, setQuality] = useState(60)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CompressResult | null>(null)

  // Hold onto the original bytes so we can offer them as fallback
  const [origBytes, setOrigBytes] = useState<Uint8Array | null>(null)

  const handleCompress = async () => {
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      const source = editor.getSource('original')
      if (!source) throw new Error('No source document available')
      const { bytes, password } = source
      setOrigBytes(bytes)
      const res = await compressPdf(bytes, { quality: quality / 100, password })
      setResult(res)
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const isBetter = result.after < result.before
    // Never produce a larger file: if compression didn't help, download original
    if (isBetter) {
      downloadBytes(result.bytes, withSuffix(editor.fileName, '-compressed'))
    } else {
      const src = origBytes ?? result.bytes
      downloadBytes(src, withSuffix(editor.fileName, '-compressed'))
    }
  }

  const isBetter = result ? result.after < result.before : false
  const pct = result ? Math.round((1 - result.after / result.before) * 100) : 0

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {t.common.cancel}
      </Button>
      {!result && (
        <Button variant="primary" onClick={handleCompress} disabled={busy}>
          {t.dialogs.compress.compressButton}
        </Button>
      )}
      {result && (
        <Button variant="primary" onClick={handleDownload}>
          <IconDownload size={16} />
          {t.common.download}
        </Button>
      )}
    </>
  )

  return (
    <Dialog
      title={t.dialogs.compress.title}
      onClose={onClose}
      size="md"
      icon={<IconCompress />}
      footer={footer}
    >
      <p class="qt-hint">{t.dialogs.compress.hint}</p>

      {/* Quality slider */}
      {!result && !busy && (
        <Field label={t.dialogs.compress.quality}>
          <div class="compress-quality">
            <span class="compress-quality__label">{t.dialogs.compress.qualityLow}</span>
            <Slider
              value={quality}
              min={10}
              max={100}
              step={5}
              onInput={setQuality}
              class="compress-quality__slider"
            />
            <span class="compress-quality__label">{t.dialogs.compress.qualityHigh}</span>
          </div>
        </Field>
      )}

      {/* Busy state */}
      {busy && (
        <div class="compress-busy">
          <Spinner size={22} />
          <span>{t.dialogs.compress.analyzing}</span>
        </div>
      )}

      {/* Result */}
      {result && !busy && (
        <>
          <div class="compress-result">
            <div class="compress-result__item">
              <span class="compress-result__label">{t.dialogs.compress.before}</span>
              <span class="compress-result__value">{formatBytes(result.before)}</span>
            </div>
            <div class="compress-result__item">
              <span class="compress-result__label">{t.dialogs.compress.after}</span>
              <span class="compress-result__value">{formatBytes(result.after)}</span>
            </div>
          </div>
          <div class={`compress-badge ${isBetter ? 'compress-badge--saved' : 'compress-badge--larger'}`}>
            {isBetter ? t.dialogs.compress.saved(pct) : t.dialogs.compress.larger}
          </div>
        </>
      )}
    </Dialog>
  )
}
