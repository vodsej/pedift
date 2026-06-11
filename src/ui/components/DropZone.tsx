import { useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { pickFiles, ACCEPT_PDF, ACCEPT_IMAGE, isPdfFile, isImageFile } from '../../io/fileio'
import { t } from '../../strings/en'

type Accept = 'pdf' | 'image' | 'any'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: Accept
  multiple?: boolean
  class?: string
  compact?: boolean
  children?: ComponentChildren
  /** Shown while dragging over the zone. */
  activeLabel?: string
  /** Accessible label for the drop zone root (role="button"). */
  label?: string
}

function acceptAttr(accept: Accept): string | undefined {
  if (accept === 'pdf') return ACCEPT_PDF
  if (accept === 'image') return ACCEPT_IMAGE
  return undefined
}

function filterFiles(files: File[], accept: Accept): File[] {
  if (accept === 'pdf') return files.filter(isPdfFile)
  if (accept === 'image') return files.filter(isImageFile)
  return files
}

export function DropZone({
  onFiles,
  accept = 'pdf',
  multiple = false,
  class: cls = '',
  compact = false,
  children,
  activeLabel,
  label = t.landing.dropTitle,
}: DropZoneProps) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    depth.current = 0
    setOver(false)
    const dropped = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
    const filtered = filterFiles(dropped, accept)
    if (filtered.length) onFiles(multiple ? filtered : [filtered[0]])
  }

  const openPicker = async () => {
    const files = await pickFiles({ accept: acceptAttr(accept), multiple })
    if (files.length) onFiles(files)
  }

  return (
    <div
      class={`dropzone ${compact ? 'dropzone--compact' : ''} ${over ? 'is-over' : ''} ${cls}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={openPicker}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openPicker())}
      onDragEnter={(e) => {
        e.preventDefault()
        depth.current++
        setOver(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current--
        if (depth.current <= 0) setOver(false)
      }}
      onDrop={handleDrop}
    >
      {over && activeLabel ? <div class="dropzone__active">{activeLabel}</div> : children}
    </div>
  )
}
