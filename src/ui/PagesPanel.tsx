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
import { t } from '../strings/en'

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
}: Props) {
  const pages = editor.pages
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const selectionIds = () => (selection.size ? [...selection] : current ? [current] : [])

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
      const ids = selection.size ? [...selection] : []
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

      {hasSel && (
        <div class="pagespanel__actions">
          <span class="pagespanel__count">{t.workspace.selectedCount(selection.size)}</span>
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
            <IconButton label={t.pagesPanel.delete} onClick={onDelete} variant="danger">
              <IconTrash size={18} />
            </IconButton>
          </div>
        </div>
      )}

      <div class={`pagespanel__list ${dragging ? 'is-dragging' : ''}`} onDragLeave={() => setDropIndex(null)}>
        {pages.map((pd, index) => (
          <div
            key={pd.id}
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
              aria-pressed={selection.has(pd.id)}
              aria-label={`${t.common.page} ${index + 1}`}
            >
              <DescriptorThumb registry={registry} descriptor={pd} />
            </button>
            <span class="pagecard__num">{index + 1}</span>
          </div>
        ))}
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
