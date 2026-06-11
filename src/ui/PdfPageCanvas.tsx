import { useEffect, useRef, useState } from 'preact/hooks'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from '../render/renderPage'
import { Spinner } from './components/Spinner'

interface Props {
  doc: PDFDocumentProxy
  pageNumber: number // 1-based
  cssWidth: number
  /** Absolute rotation; omit for the page's own rotation. */
  rotation?: number
}

/** Renders a single PDF page to a canvas, cancelling stale renders on change. */
export function PdfPageCanvas({ doc, pageNumber, cssWidth, rotation }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    let cancelled = false
    let handleCancel: (() => void) | null = null
    setRendering(true)

    const run = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return
        const handle = renderPageToCanvas(page, canvas, { cssWidth, rotation, background: '#ffffff' })
        handleCancel = handle.cancel
        await handle.promise
      } catch {
        /* render errors are non-fatal for the view */
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    void run()

    return () => {
      cancelled = true
      handleCancel?.()
    }
  }, [doc, pageNumber, cssWidth, rotation])

  return (
    <div class="pagecanvas">
      <canvas ref={canvasRef} class="pagecanvas__canvas" />
      {rendering && (
        <div class="pagecanvas__loading">
          <Spinner size={28} />
        </div>
      )}
    </div>
  )
}
