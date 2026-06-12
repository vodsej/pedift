import { useEffect, useRef } from 'preact/hooks'
import type { TextLayer } from 'pdfjs-dist'
import type { EditorDocument } from '../core/document'
import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import { buildSelectableTextLayer } from '../render/textLayer'
import { ocrWordToPdfRect } from '../core/ocr'
import { cssScale, displayHeightCss, rectPdfToView, type PageGeometry } from '../overlay/geometry'

interface Props {
  editor: EditorDocument
  registry: RenderRegistry
  descriptor: PageDescriptor
  geometry: PageGeometry
  /** Called on an empty-area click so a selected annotation deselects (the
   *  interactive overlay is pointer-events:none in select mode, so it can't). */
  onDeselect: () => void
}

/**
 * Always-on selectable/copyable text overlay, mounted only for the Select tool.
 * Renders a real pdf.js text layer (native PDF text) plus invisible spans for
 * in-memory OCR results (`editor.state.ocrData`), so the user can select & copy
 * text like a normal reader. It sits BELOW the interactive OverlayLayer, whose
 * root is pointer-events:none in select mode — so empty-area drags fall through
 * here while clicks on annotations still hit the overlay.
 */
export function SelectableTextLayer({ editor, registry, descriptor, geometry, onDeselect }: Props) {
  const nativeRef = useRef<HTMLDivElement>(null)
  const W = geometry.displayWidthCss
  const H = displayHeightCss(geometry)

  useEffect(() => {
    const container = nativeRef.current
    if (!container) return
    let cancelled = false
    let layer: TextLayer | null = null
    const run = async () => {
      const doc = await registry.get(descriptor.sourceId)
      const page = await doc.getPage(descriptor.srcIndex + 1)
      if (cancelled) return
      const viewport = page.getViewport({ scale: cssScale(geometry), rotation: geometry.rotation })
      layer = await buildSelectableTextLayer(page, viewport, container)
      if (cancelled) {
        layer.cancel()
        container.replaceChildren()
      }
    }
    void run()
    return () => {
      cancelled = true
      layer?.cancel()
      container.replaceChildren()
    }
  }, [registry, descriptor.sourceId, descriptor.srcIndex, geometry.displayWidthCss, geometry.rotation])

  const ocr = editor.state.ocrData?.[descriptor.id]

  return (
    <div
      class="selectable-text-layer"
      style={{ width: W, height: H }}
      // Any pointerdown reaching this layer means the click missed every
      // annotation (those hit the overlay above and stopPropagation), so it
      // deselects — replacing the overlay root's now-unreachable empty-click
      // handler. It doesn't preventDefault, so native text selection still starts.
      onPointerDown={() => onDeselect()}
    >
      <div class="textLayer" ref={nativeRef} />
      {ocr?.words.map((w, i) => {
        if (!w.text) return null
        const r = rectPdfToView(geometry, ocrWordToPdfRect(w, ocr))
        return (
          <span
            key={i}
            class="ocr-word"
            style={{ left: r.x, top: r.y, width: r.width, height: r.height, fontSize: r.height }}
          >
            {w.text}
          </span>
        )
      })}
    </div>
  )
}
