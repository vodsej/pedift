import '../styles/quicktools.css'
import { useState, useRef } from 'preact/hooks'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { DropZone } from '../components/DropZone'
import { Spinner } from '../components/Spinner'
import { IconMerge, IconFile } from '../icons'
import { toast } from '../toast'
import { t } from '../../strings'
import { mergePdfs } from '../../core/merge'
import { fileToBytes, downloadBytes, formatBytes } from '../../io/fileio'
import { friendlyMessage } from '../../core/errors'
import { FileRow } from './FileRow'

export function MergeWizard({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragSrc = useRef<number | null>(null)

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => {
      // Deduplicate by name+size
      const existing = new Set(prev.map((f) => `${f.name}:${f.size}`))
      const fresh = incoming.filter((f) => !existing.has(`${f.name}:${f.size}`))
      return [...prev, ...fresh]
    })
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const swap = (a: number, b: number) => {
    setFiles((prev) => {
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

  const handleMerge = async () => {
    if (files.length < 2 || busy) return
    setBusy(true)
    try {
      const items = await Promise.all(
        files.map(async (f) => ({ bytes: await fileToBytes(f) })),
      )
      const result = await mergePdfs(items)
      downloadBytes(result, 'merged.pdf')
      toast.success(t.toasts.merged(files.length))
      onClose()
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {t.common.cancel}
      </Button>
      <Button
        variant="primary"
        onClick={handleMerge}
        disabled={files.length < 2 || busy}
      >
        {busy ? t.dialogs.merge.merging : t.dialogs.merge.mergeButton}
      </Button>
    </>
  )

  return (
    <Dialog
      title={t.dialogs.merge.title}
      onClose={onClose}
      size="md"
      icon={<IconMerge />}
      footer={footer}
    >
      <p class="qt-hint">{t.dialogs.merge.hint}</p>

      {/* Primary drop zone — shown when list is empty */}
      {files.length === 0 && !busy && (
        <DropZone
          accept="pdf"
          multiple
          onFiles={addFiles}
          activeLabel={t.common.addFiles}
          class="qt-add-zone"
        >
          <span class="qt-empty">{t.dialogs.merge.empty}</span>
        </DropZone>
      )}

      {/* File list */}
      {files.length > 0 && !busy && (
        <>
          <div class="qt-list" role="list">
            {files.map((file, idx) => (
              <FileRow
                key={`${file.name}:${file.size}`}
                index={idx}
                total={files.length}
                name={file.name}
                size={formatBytes(file.size)}
                dragging={dragIdx === idx}
                dragOver={overIdx === idx}
                leading={
                  <span class="qt-file-icon">
                    <IconFile size={20} />
                  </span>
                }
                onRemove={() => removeFile(idx)}
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
            accept="pdf"
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
