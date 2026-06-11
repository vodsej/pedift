import { useState } from 'preact/hooks'
import type { OpenedSession } from './openFlow'
import { Button, IconButton } from './components/Button'
import { ThemeToggle } from './ThemeToggle'
import { ThumbnailStrip } from './ThumbnailStrip'
import { PdfPageCanvas } from './PdfPageCanvas'
import { useElementWidth } from './hooks/useElementWidth'
import {
  IconChevronLeft,
  IconZoomIn,
  IconZoomOut,
  IconFit,
  IconSave,
  IconShield,
} from './icons'
import { downloadBytes, editedFilename } from '../io/fileio'
import { toast } from './toast'
import type { Theme } from './theme'
import { t } from '../strings/en'

interface Props {
  session: OpenedSession
  theme: Theme
  onToggleTheme: () => void
  onClose: () => void
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 5
const PAGE_PADDING = 48

export function Workspace({ session, theme, onToggleTheme, onClose }: Props) {
  const { opened, fileName, bytes } = session
  const doc = opened.document
  const numPages = doc.numPages

  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>()

  const baseWidth = Math.max(240, stageWidth - PAGE_PADDING)
  const cssWidth = Math.round(baseWidth * zoom)

  const save = () => {
    try {
      downloadBytes(bytes, editedFilename(fileName))
      toast.success(t.toasts.saved(editedFilename(fileName)))
    } catch {
      toast.error(t.errors.saveFailed)
    }
  }

  const zoomBy = (factor: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * factor * 100) / 100)))

  return (
    <div class="workspace">
      <header class="topbar">
        <div class="topbar__left">
          <IconButton label={t.workspace.closeDocument} onClick={onClose}>
            <IconChevronLeft />
          </IconButton>
          <span class="topbar__filename" title={fileName}>
            {fileName}
          </span>
        </div>

        <div class="topbar__center">
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
          <Button variant="primary" onClick={save}>
            <IconSave size={18} /> {t.workspace.save}
          </Button>
        </div>
      </header>

      <div class="workspace__body">
        <aside class="sidebar">
          <div class="sidebar__head">{t.workspace.pagesPanel}</div>
          <ThumbnailStrip doc={doc} numPages={numPages} current={page} onSelect={setPage} />
        </aside>

        <main class="stage" ref={stageRef}>
          <div class="stage__scroll">
            <div class="stage__page">
              <PdfPageCanvas doc={doc} pageNumber={page} cssWidth={cssWidth} />
            </div>
          </div>
          <div class="stage__statusbar">{t.workspace.pageOf(page, numPages)}</div>
        </main>
      </div>
    </div>
  )
}
