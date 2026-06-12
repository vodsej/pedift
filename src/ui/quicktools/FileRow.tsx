import type { ComponentChildren } from 'preact'
import { IconButton } from '../components/Button'
import { IconTrash } from '../icons'
import { t } from '../../strings'

export interface FileRowProps {
  index: number
  total: number
  name: string
  size: string
  dragging: boolean
  dragOver: boolean
  /** Leading slot: thumbnail img or file-icon */
  leading?: ComponentChildren
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: () => void
  onDragOver: (e: DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}

export function FileRow({
  index,
  total,
  name,
  size,
  dragging,
  dragOver,
  leading,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: FileRowProps) {
  const cls = [
    'qt-row',
    dragging ? 'is-dragging' : '',
    dragOver ? 'is-drag-over' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      class={cls}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(e as unknown as DragEvent)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
    >
      {leading}
      <div class="qt-row__meta">
        <span class="qt-row__name" title={name}>{name}</span>
        <span class="qt-row__size">{size}</span>
      </div>
      <div class="qt-actions">
        <IconButton
          label={t.common.moveUp}
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </IconButton>
        <IconButton
          label={t.common.moveDown}
          onClick={onMoveDown}
          disabled={index === total - 1}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </IconButton>
        <IconButton
          label={t.common.remove}
          variant="danger"
          onClick={onRemove}
        >
          <IconTrash size={16} />
        </IconButton>
      </div>
    </div>
  )
}
