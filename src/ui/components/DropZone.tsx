import { useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { pickFiles, ACCEPT_PDF, ACCEPT_IMAGE, isPdfFile, isImageFile } from '../../io/fileio'
import { t } from '../../strings'

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
  /** When true, ignores clicks and drops. */
  disabled?: boolean
  /** Called when files were dropped/picked but all were filtered out by accept. */
  onReject?: (files: File[]) => void
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
  disabled = false,
  onReject,
}: DropZoneProps) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    depth.current = 0
    setOver(false)
    if (disabled) return
    const dropped = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
    const filtered = filterFiles(dropped, accept)
    if (filtered.length) {
      onFiles(multiple ? filtered : [filtered[0]])
    } else if (dropped.length > 0) {
      onReject?.(dropped)
    }
  }

  const openPicker = async () => {
    if (disabled) return
    const files = await pickFiles({ accept: acceptAttr(accept), multiple })
    if (files.length) {
      const filtered = filterFiles(files, accept)
      if (filtered.length) {
        onFiles(multiple ? filtered : [filtered[0]])
      } else if (files.length > 0) {
        onReject?.(files)
      }
    }
  }

  return (
    <div
      class={`dropzone ${compact ? 'dropzone--compact' : ''} ${over ? 'is-over' : ''} ${disabled ? 'is-disabled' : ''} ${cls}`}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      style={disabled ? { pointerEvents: 'none', opacity: 0.7 } : undefined}
      onClick={openPicker}
      onKeyDown={(e) => !disabled && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openPicker())}
      onDragEnter={(e) => {
        if (disabled) return
        e.preventDefault()
        depth.current++
        setOver(true)
      }}
      onDragOver={(e) => { if (!disabled) e.preventDefault() }}
      onDragLeave={() => {
        if (disabled) return
        depth.current--
        if (depth.current <= 0) setOver(false)
      }}
      onDrop={handleDrop}
    >
      {over && activeLabel ? <div class="dropzone__active">{activeLabel}</div> : children}
    </div>
  )
}
