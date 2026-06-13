import '../styles/compress.css'
import { useState } from 'preact/hooks'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { DropZone } from '../components/DropZone'
import { Field, Slider } from '../components/controls'
import { Spinner } from '../components/Spinner'
import { IconCompress, IconDownload, IconFile } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import { compressPdf } from '../../core/compress'
import { fileToBytes, downloadBytes, formatBytes, withSuffix } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import type { CompressResult } from '../../core/compress'

export function CompressWizard({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState(60)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CompressResult | null>(null)
  // Keep original bytes so download can fall back when compression yields no gain
  const [origBytes, setOrigBytes] = useState<Uint8Array | null>(null)

  const handleFiles = (files: File[]) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setOrigBytes(null)
  }

  const handleCompress = async () => {
    if (!file || busy) return
    setBusy(true)
    setResult(null)
    try {
      const bytes = await fileToBytes(file)
      setOrigBytes(bytes)
      const res = await compressPdf(bytes, { quality: quality / 100 })
      setResult(res)
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = () => {
    if (!result || !file) return
    const isBetter = result.after < result.before
    // Never produce a larger file than the input
    if (isBetter) {
      downloadBytes(result.bytes, withSuffix(file.name, '-compressed'))
    } else {
      const src = origBytes ?? result.bytes
      downloadBytes(src, withSuffix(file.name, '-compressed'))
    }
  }

  const saved = result ? result.after < result.before : false
  const pct = result ? Math.round((1 - result.after / result.before) * 100) : 0

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {t.common.cancel}
      </Button>
      {!result && (
        <Button
          variant="primary"
          onClick={handleCompress}
          disabled={!file || busy}
        >
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

      {/* File picker — shown until we have a file */}
      {!file && !busy && (
        <DropZone
          accept="pdf"
          onFiles={handleFiles}
          class="compress-drop"
          activeLabel={t.landing.dropActive}
        >
          <span class="qt-empty">{t.dialogs.compress.pickFile}</span>
        </DropZone>
      )}

      {/* Selected file row */}
      {file && !busy && (
        <div class="compress-file">
          <span class="compress-file__icon">
            <IconFile size={20} />
          </span>
          <span class="compress-file__name">{file.name}</span>
          <span class="compress-file__size">{formatBytes(file.size)}</span>
        </div>
      )}

      {/* Quality slider — shown once a file is selected and before compress runs */}
      {file && !busy && !result && (
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

      {/* Result summary */}
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
          <div class={`compress-badge ${saved ? 'compress-badge--saved' : 'compress-badge--larger'}`}>
            {saved ? t.dialogs.compress.saved(pct) : t.dialogs.compress.larger}
          </div>
        </>
      )}
    </Dialog>
  )
}
