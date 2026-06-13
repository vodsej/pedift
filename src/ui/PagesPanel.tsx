import { useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import type { RenderRegistry } from '../render/registry'
import { DescriptorThumb } from './DescriptorThumb'
import { IconButton, Button } from './components/Button'
import {
  IconRotateLeft,
  IconRotateRight,
  IconDuplicate,
  IconTrash,
  IconExtract,
  IconScissors,
  IconInsert,
  IconImage,
} from './icons'
import { t } from '../strings'

interface Props {
  editor: EditorDocument
  registry: RenderRegistry
  selection: Set<string>
  setSelection: (s: Set<string>) => void
  current: string | null
  setCurrent: (id: string) => void
  onDelete: () => void
  onExtract: () => void
  onSplit: () => void
  onInsert: () => void
  onExportImage: () => void
  /** Pages holding a live search match — drawn as a dot on the thumbnail. */
  matchPageIds?: Set<string> | null
  /** Fired when a single page is tapped to view it — lets the mobile drawer close. */
  onPick?: () => void
}

export function PagesPanel({
  editor,
  registry,
  selection,
  setSelection,
  current,
  setCurrent,
  onDelete,
  onExtract,
  onSplit,
  onInsert,
  onExportImage,
  matchPageIds,
  onPick,
}: Props) {
  const pages = editor.pages
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [announce, setAnnounce] = useState('')

  const selectionIds = () => (selection.size ? [...selection] : current ? [current] : [])

  // Keyboard reorder (Alt+Arrow) — the only path that isn't drag-and-drop.
  const movePageBy = (index: number, dir: -1 | 1) => {
    if ((dir === -1 && index === 0) || (dir === 1 && index === pages.length - 1)) return
    const id = pages[index].id
    const to = dir === -1 ? index - 1 : index + 2 // movePages inserts *before* `to`
    editor.reorder([id], to)
    setCurrent(id)
    setSelection(new Set([id]))
    setAnnounce(t.pagesPanel.movedTo(dir === -1 ? index : index + 2, pages.length))
  }

  const onThumbClick = (e: MouseEvent, id: string, index: number) => {
    if (e.shiftKey && current) {
      const anchor = pages.findIndex((p) => p.id === current)
      if (anchor >= 0) {
        const [a, b] = anchor < index ? [anchor, index] : [index, anchor]
        setSelection(new Set(pages.slice(a, b + 1).map((p) => p.id)))
        setCurrent(id)
        return
      }
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selection)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelection(next)
      setCurrent(id)
      return
    }
    setSelection(new Set([id]))
    setCurrent(id)
    onPick?.() // plain tap = "view this page" → close the mobile drawer
  }

  const startDrag = (e: DragEvent, id: string) => {
    if (!selection.has(id)) setSelection(new Set([id]))
    setDragging(true)
    e.dataTransfer?.setData('text/plain', id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  const overThumb = (e: DragEvent, index: number) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    setDropIndex(after ? index + 1 : index)
  }

  const drop = () => {
    if (dropIndex != null) {
      const ids = selectionIds()
      if (ids.length) editor.reorder(ids, dropIndex)
    }
    setDropIndex(null)
    setDragging(false)
  }

  const rotate = (delta: number) => editor.rotate(selectionIds(), delta)
  const duplicate = () => editor.duplicate(selectionIds())
  const selectAll = () => setSelection(new Set(pages.map((p) => p.id)))
  const clearSel = () => setSelection(new Set())

  const hasSel = selection.size > 0
  const currentIndex = pages.findIndex((p) => p.id === current)
  // The action bar targets the selection, or — with none — the current page.
  const showActions = hasSel || current != null
  const wouldEmpty = selectionIds().length >= pages.length // deleting all is refused

  return (
    <div class="pagespanel">
      <div class="pagespanel__head">
        <span class="pagespanel__title">{t.workspace.pagesPanel}</span>
        <button
          class="linkbtn"
          onClick={hasSel ? clearSel : selectAll}
          type="button"
        >
          {hasSel ? t.pagesPanel.deselectAll : t.pagesPanel.selectAll}
        </button>
      </div>

      {showActions && (
        <div class="pagespanel__actions">
          <span class="pagespanel__count">
            {hasSel
              ? t.workspace.selectedCount(selection.size)
              : `${t.common.page} ${currentIndex + 1}`}
          </span>
          <div class="pagespanel__actionbtns">
            <IconButton label={t.pagesPanel.rotateLeft} onClick={() => rotate(-90)}>
              <IconRotateLeft size={18} />
            </IconButton>
            <IconButton label={t.pagesPanel.rotateRight} onClick={() => rotate(90)}>
              <IconRotateRight size={18} />
            </IconButton>
            <IconButton label={t.pagesPanel.duplicate} onClick={duplicate}>
              <IconDuplicate size={18} />
            </IconButton>
            <IconButton label={t.pagesPanel.extract} onClick={onExtract}>
              <IconExtract size={18} />
            </IconButton>
            <IconButton label={t.pagesPanel.exportImage} onClick={onExportImage}>
              <IconImage size={18} />
            </IconButton>
            <IconButton
              label={t.pagesPanel.delete}
              onClick={onDelete}
              variant="danger"
              disabled={wouldEmpty}
            >
              <IconTrash size={18} />
            </IconButton>
          </div>
        </div>
      )}

      <div
        class={`pagespanel__list ${dragging ? 'is-dragging' : ''}`}
        role="list"
        onDragOver={(e) => {
          // Dragging into the empty area below the last card → drop at the end.
          if (e.target === e.currentTarget) {
            e.preventDefault()
            setDropIndex(pages.length)
          }
        }}
        onDragLeave={() => setDropIndex(null)}
      >
        {pages.map((pd, index) => (
          <div
            key={pd.id}
            role="listitem"
            class={`pagecard ${selection.has(pd.id) ? 'is-selected' : ''} ${current === pd.id ? 'is-current' : ''} ${dropIndex === index ? 'drop-before' : ''} ${dropIndex === index + 1 && index === pages.length - 1 ? 'drop-after' : ''}`}
            draggable
            onDragStart={(e) => startDrag(e, pd.id)}
            onDragOver={(e) => overThumb(e, index)}
            onDrop={drop}
            onDragEnd={() => {
              setDropIndex(null)
              setDragging(false)
            }}
          >
            <button
              type="button"
              class="pagecard__btn"
              onClick={(e) => onThumbClick(e, pd.id, index)}
              onKeyDown={(e) => {
                if (!e.altKey) return
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  movePageBy(index, -1)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  movePageBy(index, 1)
                }
              }}
              aria-pressed={selection.has(pd.id)}
              aria-label={`${t.common.page} ${index + 1}`}
            >
              <DescriptorThumb registry={registry} descriptor={pd} />
            </button>
            {matchPageIds?.has(pd.id) && (
              <span class="pagecard__match" title={t.find.open} aria-hidden="true" />
            )}
            <span class="pagecard__num">{index + 1}</span>
          </div>
        ))}
      </div>

      <div class="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <div class="pagespanel__foot">
        <Button size="sm" variant="ghost" onClick={onInsert}>
          <IconInsert size={16} /> {t.pagesPanel.insert}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSplit}>
          <IconScissors size={16} /> {t.pagesPanel.split}
        </Button>
      </div>
    </div>
  )
}
