import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import type { RenderRegistry } from '../render/registry'
import { Button, IconButton } from './components/Button'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ThemeToggle } from './ThemeToggle'
import { LangToggle } from './LangToggle'
import { PagesPanel } from './PagesPanel'
import { PageStage } from './PageStage'
import { AnnotateToolbar } from './AnnotateToolbar'
import { OverlayLayer } from '../overlay/OverlayLayer'
import { rasterizeRedactedPage } from '../render/redactRaster'
import { CropOverlay } from '../overlay/CropOverlay'
import { TextSelectLayer } from './TextSelectLayer'
import { SelectableTextLayer } from './SelectableTextLayer'
import { SearchHighlightLayer } from './SearchHighlightLayer'
import { FindBar } from './FindBar'
import { PreviewLayer } from '../overlay/PreviewLayer'
import { DocumentMenu, type DocAction } from './DocumentMenu'
import { SplitDialog } from './dialogs/SplitDialog'
import { InsertDialog } from './dialogs/InsertDialog'
import { ExportImageDialog } from './dialogs/ExportImageDialog'
import { SignatureDialog } from './dialogs/SignatureDialog'
import { MetadataDialog } from './dialogs/MetadataDialog'
import { WatermarkDialog } from './dialogs/WatermarkDialog'
import { PageNumbersDialog } from './dialogs/PageNumbersDialog'
import { FillFormsDialog } from './dialogs/FillFormsDialog'
import { FlattenDialog } from './dialogs/FlattenDialog'
import { ProtectDialog } from './dialogs/ProtectDialog'
import { CompressDialog } from './dialogs/CompressDialog'
import { useEditorState } from './hooks/useEditor'
import { useElementWidth } from './hooks/useElementWidth'
import { useSearch } from './hooks/useSearch'
import { defaultToolOptions, type ToolId, type ToolOptions, type InsertRequest } from '../overlay/tools'
import { detectImageFormat } from '../core/imagesToPdf'
import {
  IconChevronLeft,
  IconZoomIn,
  IconZoomOut,
  IconFit,
  IconFitPage,
  IconSave,
  IconSearch,
  IconShield,
  IconUndo,
  IconRedo,
} from './icons'
import {
  downloadBytes,
  editedFilename,
  withSuffix,
  pickFiles,
  fileToBytes,
  loadImageSize,
  ACCEPT_IMAGE,
} from '../io/fileio'
import { friendlyMessage } from '../core/errors'
import { toast } from './toast'
import type { Theme } from './theme'
import { t, type Locale } from '../strings'

interface Props {
  editor: EditorDocument
  registry: RenderRegistry
  fileName: string
  theme: Theme
  onToggleTheme: () => void
  locale: Locale
  onSetLocale: (locale: Locale) => void
  onClose: () => void
  protectSupported: boolean
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 5
const PAGE_PADDING = 56

type ActiveDialog = 'split' | 'insert' | 'export' | 'confirmDelete' | 'confirmClose' | null

export function Workspace({
  editor,
  registry,
  fileName,
  theme,
  onToggleTheme,
  locale,
  onSetLocale,
  onClose,
  protectSupported,
}: Props) {
  useEditorState(editor)
  const pages = editor.pages

  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState<string | null>(pages[0]?.id ?? null)
  const [zoom, setZoom] = useState(1)
  const [dialog, setDialog] = useState<ActiveDialog>(null)
  const [saving, setSaving] = useState(false)
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Overlay editing state.
  const [tool, setTool] = useState<ToolId>('select')
  const [toolOptions, setToolOptions] = useState<ToolOptions>(defaultToolOptions())
  const [overlaySel, setOverlaySel] = useState<string | null>(null)
  const [insertRequest, setInsertRequest] = useState<InsertRequest | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [docDialog, setDocDialog] = useState<DocAction | null>(null)
  const [pageAspect, setPageAspect] = useState(1.414)
  const search = useSearch(editor, registry)
  const [OcrDialogComp, setOcrDialogComp] =
    useState<null | typeof import('./dialogs/OcrDialog')['OcrDialog']>(null)

  useEffect(() => {
    if (__OCR__ && docDialog === 'ocr' && !OcrDialogComp) {
      void import('./dialogs/OcrDialog').then((m) => setOcrDialogComp(() => m.OcrDialog))
    }
  }, [docDialog, OcrDialogComp])

  // Wire the true-redaction rasterizer (needs the render layer, so it can't live
  // in core). Every build path then flattens redacted pages automatically.
  useEffect(() => {
    editor.setRedactionRasterizer((descriptor, rects) =>
      rasterizeRedactedPage(registry, descriptor, rects),
    )
  }, [editor, registry])

  const onDocAction = (a: DocAction) => {
    if (a === 'crop') {
      setTool('select')
      setCropMode(true)
    } else {
      setDocDialog(a)
    }
  }

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

  // Overlay selection is per-page; clear it when the viewed page changes.
  useEffect(() => {
    setOverlaySel(null)
  }, [currentDescriptor?.id])

  const insertImage = async () => {
    const files = await pickFiles({ accept: ACCEPT_IMAGE })
    const file = files[0]
    if (!file) return
    try {
      const bytes = await fileToBytes(file)
      const format = detectImageFormat(bytes)
      const { width, height } = await loadImageSize(bytes, format)
      const imageKey = editor.addImage({ bytes, format, width, height })
      setTool('select')
      setInsertRequest({ kind: 'image', imageKey, format, aspect: width / Math.max(1, height) })
    } catch (err) {
      toast.error(friendlyMessage(err))
    }
  }

  const placeSignature = (pngBytes: Uint8Array, aspect: number) => {
    const imageKey = editor.addImage({
      bytes: pngBytes,
      format: 'png',
      width: Math.round(aspect * 120),
      height: 120,
    })
    setShowSignature(false)
    setTool('select')
    setInsertRequest({ kind: 'signature', imageKey, aspect })
  }

  const placeStamp = (text: string) => {
    setTool('select')
    setInsertRequest({ kind: 'stamp', text, color: '#c0392b', fontSize: 28 })
  }

  const baseWidth = Math.max(220, stageWidth - PAGE_PADDING)
  const cssWidth = Math.round(baseWidth * zoom)
  const selectionIds = () => (selection.size ? [...selection] : current ? [current] : [])

  const zoomBy = (factor: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * factor * 100) / 100)))

  const fitPage = () => {
    const el = stageRef.current
    if (!el || !pageAspect) {
      setZoom(1)
      return
    }
    const availH = el.clientHeight - 90 // statusbar + padding
    const z = availH / (baseWidth * pageAspect)
    setZoom(Math.min(1, Math.max(ZOOM_MIN, z)))
  }

  const save = async () => {
    if (saving) return
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

  // Find (Ctrl+F) — handled separately so it fires even from inputs (to override
  // the browser's own find) and only when no modal dialog is in front.
  useEffect(() => {
    const modalOpen = dialog !== null || docDialog !== null || showSignature
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'f' && !modalOpen) {
        e.preventDefault()
        search.setOpen(true)
      } else if (e.key === 'Escape' && search.open && !modalOpen) {
        search.setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [search.open, search.setOpen, dialog, docDialog, showSignature])

  // Jump the viewed page to the active match (and the highlight layer scrolls to it).
  useEffect(() => {
    const m = search.activeMatch
    if (m && m.pageId !== current) setCurrent(m.pageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.activeMatch])

  // Ctrl+wheel / trackpad pinch zooms the PDF instead of the browser page.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // plain wheel -> native scroll
      e.preventDefault() // block browser zoom (needs passive:false)
      const dy = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY // lines -> px
      const factor = Math.exp(-dy * 0.0015)
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div class="workspace">
      <header class="topbar">
        <div class="topbar__left">
          <IconButton
            label={t.workspace.closeDocument}
            onClick={() => (editor.canUndo ? setDialog('confirmClose') : onClose())}
          >
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
          <IconButton label={t.workspace.fitPage} onClick={fitPage}>
            <IconFitPage />
          </IconButton>
          <span class="topbar__divider" />
          <IconButton
            label={t.find.open}
            active={search.open}
            onClick={() => search.setOpen(!search.open)}
          >
            <IconSearch />
          </IconButton>
        </div>

        <div class="topbar__right">
          <span class="privacy-badge privacy-badge--mini" data-tooltip={t.privacy.line}>
            <IconShield size={14} /> {t.privacy.badge}
          </span>
          <DocumentMenu onSelect={onDocAction} />
          <LangToggle locale={locale} onSelect={onSetLocale} />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button variant="primary" onClick={save} disabled={saving}>
            <IconSave size={18} /> {saving ? t.workspace.saving : t.workspace.save}
          </Button>
        </div>
      </header>

      <AnnotateToolbar
        tool={tool}
        setTool={setTool}
        options={toolOptions}
        setOptions={setToolOptions}
        onInsertImage={insertImage}
        onSignature={() => setShowSignature(true)}
        onStamp={placeStamp}
      />

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
          {search.open && <FindBar search={search} />}
          <div class="stage__scroll" ref={scrollRef}>
            {currentDescriptor && (
              <PageStage
                registry={registry}
                descriptor={currentDescriptor}
                cssWidth={cssWidth}
                onAspect={setPageAspect}
                renderOverlay={(geometry) => (
                  <>
                    {search.open && search.effectiveQuery && (
                      <SearchHighlightLayer
                        editor={editor}
                        registry={registry}
                        descriptor={currentDescriptor}
                        geometry={geometry}
                        query={search.effectiveQuery}
                        activeLocalIndex={
                          search.activeMatch && search.activeMatch.pageId === currentDescriptor.id
                            ? search.activeMatch.localIndex
                            : -1
                        }
                      />
                    )}
                    {cropMode ? (
                      <CropOverlay
                        geometry={geometry}
                        editor={editor}
                        pageId={currentDescriptor.id}
                        onDone={() => setCropMode(false)}
                      />
                    ) : tool === 'replaceText' ? (
                      <TextSelectLayer
                        editor={editor}
                        registry={registry}
                        descriptor={currentDescriptor}
                        geometry={geometry}
                        onReplaced={(id) => {
                          setTool('select')
                          setOverlaySel(id)
                        }}
                      />
                    ) : (
                      <>
                        {tool === 'select' && (
                          <SelectableTextLayer
                            editor={editor}
                            registry={registry}
                            descriptor={currentDescriptor}
                            geometry={geometry}
                            onDeselect={() => setOverlaySel(null)}
                          />
                        )}
                        <OverlayLayer
                          editor={editor}
                          pageId={currentDescriptor.id}
                          geometry={geometry}
                          tool={tool}
                          options={toolOptions}
                          selectedId={overlaySel}
                          setSelectedId={setOverlaySel}
                          onPlaced={() => setTool('select')}
                          insertRequest={insertRequest}
                          onInsertConsumed={() => setInsertRequest(null)}
                        />
                      </>
                    )}
                    <PreviewLayer
                      editor={editor}
                      descriptor={currentDescriptor}
                      geometry={geometry}
                      pageIndex={pages.findIndex((p) => p.id === currentDescriptor.id)}
                      showCrop={!cropMode}
                    />
                  </>
                )}
              />
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
      {showSignature && (
        <SignatureDialog onClose={() => setShowSignature(false)} onConfirm={placeSignature} />
      )}

      {docDialog === 'metadata' && <MetadataDialog editor={editor} onClose={() => setDocDialog(null)} />}
      {docDialog === 'watermark' && <WatermarkDialog editor={editor} onClose={() => setDocDialog(null)} />}
      {docDialog === 'pagenumbers' && (
        <PageNumbersDialog editor={editor} onClose={() => setDocDialog(null)} />
      )}
      {docDialog === 'forms' && (
        <FillFormsDialog editor={editor} registry={registry} onClose={() => setDocDialog(null)} />
      )}
      {docDialog === 'flatten' && (
        <FlattenDialog editor={editor} registry={registry} onClose={() => setDocDialog(null)} />
      )}
      {docDialog === 'protect' && (
        <ProtectDialog editor={editor} supported={protectSupported} onClose={() => setDocDialog(null)} />
      )}
      {docDialog === 'compress' && <CompressDialog editor={editor} onClose={() => setDocDialog(null)} />}
      {__OCR__ && docDialog === 'ocr' && OcrDialogComp && (
        <OcrDialogComp editor={editor} registry={registry} onClose={() => setDocDialog(null)} />
      )}
    </div>
  )
}
