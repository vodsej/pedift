import '../styles/quicktools.css'
import { useState, useRef, useEffect } from 'preact/hooks'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { DropZone } from '../components/DropZone'
import { Spinner } from '../components/Spinner'
import { Field, SegmentedControl, Slider } from '../components/controls'
import { IconImage } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import { imagesToPdf, detectImageFormat } from '../../core/imagesToPdf'
import type { PageSizeName, Orientation } from '../../core/imagesToPdf'
import { fileToBytes, downloadBytes, formatBytes } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import { FileRow } from './FileRow'

interface ImageEntry {
  file: File
  thumbUrl: string
}

export function ImagesToPdfWizard({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ImageEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState<PageSizeName>('a4')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [margin, setMargin] = useState(16)
  const dragSrc = useRef<number | null>(null)

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      setEntries((prev) => {
        prev.forEach((e) => URL.revokeObjectURL(e.thumbUrl))
        return prev
      })
    }
  }, [])

  const addFiles = (incoming: File[]) => {
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => `${e.file.name}:${e.file.size}`))
      const fresh = incoming
        .filter((f) => !existing.has(`${f.name}:${f.size}`))
        .map((f) => ({ file: f, thumbUrl: URL.createObjectURL(f) }))
      return [...prev, ...fresh]
    })
  }

  const removeEntry = (idx: number) => {
    setEntries((prev) => {
      URL.revokeObjectURL(prev[idx].thumbUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const swap = (a: number, b: number) => {
    setEntries((prev) => {
      const next = [...prev]
      ;[next[a], next[b]] = [next[b], next[a]]
      return next
    })
  }

  const handleDragStart = (idx: number) => {
    dragSrc.current = idx
    setDragIdx(idx)
  }

  const handleDragOver = (idx: number) => {
    if (dragSrc.current !== null && dragSrc.current !== idx) {
      setOverIdx(idx)
    }
  }

  const handleDrop = (idx: number) => {
    if (dragSrc.current !== null && dragSrc.current !== idx) {
      swap(dragSrc.current, idx)
    }
    setDragIdx(null)
    setOverIdx(null)
    dragSrc.current = null
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setOverIdx(null)
    dragSrc.current = null
  }

  const handleCreate = async () => {
    if (entries.length === 0 || busy) return
    setBusy(true)
    try {
      const images = await Promise.all(
        entries.map(async (e) => {
          const bytes = await fileToBytes(e.file)
          const format = detectImageFormat(bytes)
          return { bytes, format }
        }),
      )
      const result = await imagesToPdf(images, { pageSize, orientation, margin })
      downloadBytes(result, 'images.pdf')
      toast.success(t.toasts.createdFromImages(entries.length))
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const isFit = pageSize === 'fit'

  const pageSizeOptions: Array<{ value: PageSizeName; label: string }> = [
    { value: 'a4', label: t.dialogs.imagesToPdf.a4 },
    { value: 'letter', label: t.dialogs.imagesToPdf.letter },
    { value: 'fit', label: t.dialogs.imagesToPdf.fitImage },
  ]

  const orientationOptions: Array<{ value: Orientation; label: string }> = [
    { value: 'portrait', label: t.dialogs.imagesToPdf.portrait },
    { value: 'landscape', label: t.dialogs.imagesToPdf.landscape },
  ]

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {t.common.cancel}
      </Button>
      <Button
        variant="primary"
        onClick={handleCreate}
        disabled={entries.length === 0 || busy}
      >
        {busy ? t.dialogs.imagesToPdf.creating : t.dialogs.imagesToPdf.createButton}
      </Button>
    </>
  )

  return (
    <Dialog
      title={t.dialogs.imagesToPdf.title}
      onClose={onClose}
      size="md"
      icon={<IconImage />}
      footer={footer}
    >
      <p class="qt-hint">{t.dialogs.imagesToPdf.hint}</p>

      {/* Options panel */}
      <div class="qt-options">
        <Field label={t.dialogs.imagesToPdf.pageSize}>
          <SegmentedControl<PageSizeName>
            value={pageSize}
            onChange={setPageSize}
            options={pageSizeOptions}
          />
        </Field>

        {!isFit && (
          <Field label={t.dialogs.imagesToPdf.orientation}>
            <SegmentedControl<Orientation>
              value={orientation}
              onChange={setOrientation}
              options={orientationOptions}
            />
          </Field>
        )}

        {!isFit && (
          <Field label={t.dialogs.imagesToPdf.margin}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Slider
                value={margin}
                min={0}
                max={72}
                step={4}
                onInput={setMargin}
              />
              <span class="qt-margin-val">{margin} pt</span>
            </div>
          </Field>
        )}
      </div>

      {/* Primary drop zone — shown when list is empty */}
      {entries.length === 0 && !busy && (
        <DropZone
          accept="image"
          multiple
          onFiles={addFiles}
          activeLabel={t.common.addFiles}
          class="qt-add-zone"
        >
          <span class="qt-empty">{t.dialogs.imagesToPdf.empty}</span>
        </DropZone>
      )}

      {/* Image list */}
      {entries.length > 0 && !busy && (
        <>
          <div class="qt-list" role="list">
            {entries.map((entry, idx) => (
              <FileRow
                key={`${entry.file.name}:${entry.file.size}`}
                index={idx}
                total={entries.length}
                name={entry.file.name}
                size={formatBytes(entry.file.size)}
                dragging={dragIdx === idx}
                dragOver={overIdx === idx}
                leading={
                  <img
                    class="qt-thumb"
                    src={entry.thumbUrl}
                    alt={entry.file.name}
                    loading="lazy"
                  />
                }
                onRemove={() => removeEntry(idx)}
                onMoveUp={() => swap(idx, idx - 1)}
                onMoveDown={() => swap(idx, idx + 1)}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={() => handleDragOver(idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>

          {/* Add-more strip */}
          <DropZone
            accept="image"
            multiple
            compact
            onFiles={addFiles}
            activeLabel={t.common.addFiles}
            class="qt-add-zone"
          >
            {t.common.addMore}
          </DropZone>
        </>
      )}

      {/* Busy state */}
      {busy && (
        <div class="qt-busy">
          <Spinner size={22} />
          <span>{t.common.loading}</span>
        </div>
      )}
    </Dialog>
  )
}
