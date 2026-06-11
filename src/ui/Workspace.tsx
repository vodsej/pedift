import { useEffect, useMemo, useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import type { RenderRegistry } from '../render/registry'
import { Button, IconButton } from './components/Button'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ThemeToggle } from './ThemeToggle'
import { PagesPanel } from './PagesPanel'
import { PageStage } from './PageStage'
import { SplitDialog } from './dialogs/SplitDialog'
import { InsertDialog } from './dialogs/InsertDialog'
import { ExportImageDialog } from './dialogs/ExportImageDialog'
import { useEditorState } from './hooks/useEditor'
import { useElementWidth } from './hooks/useElementWidth'
import {
  IconChevronLeft,
  IconZoomIn,
  IconZoomOut,
  IconFit,
  IconSave,
  IconShield,
  IconUndo,
  IconRedo,
} from './icons'
import { downloadBytes, editedFilename, withSuffix } from '../io/fileio'
import { friendlyMessage } from '../core/errors'
import { toast } from './toast'
import type { Theme } from './theme'
import { t } from '../strings/en'

interface Props {
  editor: EditorDocument
  registry: RenderRegistry
  fileName: string
  theme: Theme
  onToggleTheme: () => void
  onClose: () => void
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 5
const PAGE_PADDING = 56

type ActiveDialog = 'split' | 'insert' | 'export' | 'confirmDelete' | 'confirmClose' | null

export function Workspace({ editor, registry, fileName, theme, onToggleTheme, onClose }: Props) {
  useEditorState(editor)
  const pages = editor.pages

  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState<string | null>(pages[0]?.id ?? null)
  const [zoom, setZoom] = useState(1)
  const [dialog, setDialog] = useState<ActiveDialog>(null)
  const [saving, setSaving] = useState(false)
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>()

  // Keep `current` valid as pages change (delete/reorder).
  useEffect(() => {
    if (!current || !pages.some((p) => p.id === current)) {
      setCurrent(pages[0]?.id ?? null)
    }
  }, [pages, current])

  const currentDescriptor = useMemo(
    () => pages.find((p) => p.id === current) ?? pages[0] ?? null,
    [pages, current],
  )

  const baseWidth = Math.max(220, stageWidth - PAGE_PADDING)
  const cssWidth = Math.round(baseWidth * zoom)
  const selectionIds = () => (selection.size ? [...selection] : current ? [current] : [])

  const zoomBy = (factor: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * factor * 100) / 100)))

  const save = async () => {
    setSaving(true)
    try {
      const bytes = await editor.build()
      downloadBytes(bytes, editedFilename(fileName))
      toast.success(t.toasts.saved(editedFilename(fileName)))
    } catch (err) {
      toast.error(friendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = () => {
    const ids = selectionIds()
    if (!ids.length) return
    editor.remove(ids)
    setSelection(new Set())
    setDialog(null)
    toast.success(t.toasts.pagesDeleted(ids.length))
  }

  const extract = async () => {
    const ids = selectionIds()
    if (!ids.length) return
    try {
      const bytes = await editor.buildSubsetByIds(ids)
      downloadBytes(bytes, withSuffix(fileName, '-extract'))
      toast.success(t.toasts.pagesExtracted(ids.length))
    } catch (err) {
      toast.error(friendlyMessage(err))
    }
  }

  // Keyboard shortcuts (full pass in Phase 5; the essentials here).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (!editor.undo()) toast.info(t.toasts.nothingToUndo)
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (!editor.redo()) toast.info(t.toasts.nothingToRedo)
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomBy(1.25)
      } else if (mod && e.key === '-') {
        e.preventDefault()
        zoomBy(0.8)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, fileName])

  return (
    <div class="workspace">
      <header class="topbar">
        <div class="topbar__left">
          <IconButton label={t.workspace.closeDocument} onClick={() => setDialog('confirmClose')}>
            <IconChevronLeft />
          </IconButton>
          <span class="topbar__filename" title={fileName}>
            {fileName}
          </span>
        </div>

        <div class="topbar__center">
          <IconButton label={t.workspace.undo} onClick={() => editor.undo()} disabled={!editor.canUndo}>
            <IconUndo />
          </IconButton>
          <IconButton label={t.workspace.redo} onClick={() => editor.redo()} disabled={!editor.canRedo}>
            <IconRedo />
          </IconButton>
          <span class="topbar__divider" />
          <IconButton label={t.workspace.zoomOut} onClick={() => zoomBy(0.8)}>
            <IconZoomOut />
          </IconButton>
          <span class="zoom-label">{Math.round(zoom * 100)}%</span>
          <IconButton label={t.workspace.zoomIn} onClick={() => zoomBy(1.25)}>
            <IconZoomIn />
          </IconButton>
          <IconButton label={t.workspace.fitWidth} onClick={() => setZoom(1)}>
            <IconFit />
          </IconButton>
        </div>

        <div class="topbar__right">
          <span class="privacy-badge privacy-badge--mini" data-tooltip={t.privacy.line}>
            <IconShield size={14} /> {t.privacy.badge}
          </span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button variant="primary" onClick={save} disabled={saving}>
            <IconSave size={18} /> {saving ? t.workspace.saving : t.workspace.save}
          </Button>
        </div>
      </header>

      <div class="workspace__body">
        <aside class="sidebar">
          <PagesPanel
            editor={editor}
            registry={registry}
            selection={selection}
            setSelection={setSelection}
            current={current}
            setCurrent={setCurrent}
            onDelete={() => setDialog('confirmDelete')}
            onExtract={extract}
            onSplit={() => setDialog('split')}
            onInsert={() => setDialog('insert')}
            onExportImage={() => setDialog('export')}
          />
        </aside>

        <main class="stage" ref={stageRef}>
          <div class="stage__scroll">
            {currentDescriptor && (
              <PageStage registry={registry} descriptor={currentDescriptor} cssWidth={cssWidth} />
            )}
          </div>
          <div class="stage__statusbar">
            {currentDescriptor
              ? t.workspace.pageOf(pages.findIndex((p) => p.id === currentDescriptor.id) + 1, pages.length)
              : t.empty.noPages}
          </div>
        </main>
      </div>

      {dialog === 'confirmDelete' && (
        <ConfirmDialog
          title={t.pagesPanel.delete}
          message={t.pagesPanel.deleteConfirm(selectionIds().length)}
          confirmLabel={t.common.delete}
          onConfirm={doDelete}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'confirmClose' && (
        <ConfirmDialog
          title={t.workspace.closeDocument}
          message={t.workspace.closeConfirm}
          confirmLabel={t.workspace.closeDocument}
          onConfirm={onClose}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'split' && <SplitDialog editor={editor} fileName={fileName} onClose={() => setDialog(null)} />}
      {dialog === 'insert' && (
        <InsertDialog editor={editor} onClose={() => setDialog(null)} insertAfter={current} />
      )}
      {dialog === 'export' && (
        <ExportImageDialog
          editor={editor}
          registry={registry}
          ids={selectionIds()}
          fileName={fileName}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
