import { useEffect, useRef, useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import { buildPageSegments } from '../render/textLayer'
import { findInSegments, type SearchMatch } from '../render/search'
import { ocrSegments } from './hooks/useSearch'
import { displayHeightCss, rotatedSizePts, type PageGeometry } from '../overlay/geometry'

interface Props {
  editor: EditorDocument
  registry: RenderRegistry
  descriptor: PageDescriptor
  geometry: PageGeometry
  /** Debounced query (matches the index in useSearch). */
  query: string
  /** Which match on this page is the active one, or -1 if none. */
  activeLocalIndex: number
}

/**
 * Draws find-result highlights over the current page. It re-runs the same match
 * logic the cross-page index uses (`buildPageSegments` + `ocrSegments` →
 * `findInSegments`), so match N here is match N in the find bar's counter — only
 * here the boxes are real (current geometry) and get painted.
 */
export function SearchHighlightLayer({
  editor,
  registry,
  descriptor,
  geometry,
  query,
  activeLocalIndex,
}: Props) {
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const activeRef = useRef<HTMLDivElement>(null)
  const W = geometry.displayWidthCss
  const H = displayHeightCss(geometry)

  useEffect(() => {
    if (!query) {
      setMatches([])
      return
    }
    let cancelled = false
    void (async () => {
      const doc = await registry.get(descriptor.sourceId)
      const page = await doc.getPage(descriptor.srcIndex + 1)
      const dpr = window.devicePixelRatio || 1
      const rotW = rotatedSizePts(geometry).w
      const scale = (geometry.displayWidthCss / rotW) * dpr
      const viewport = page.getViewport({ scale, rotation: geometry.rotation })
      const native = await buildPageSegments(page, viewport, dpr)
      if (cancelled) return
      const ocr = editor.state.ocrData?.[descriptor.id]
      const segs = ocr ? [...native, ...ocrSegments(ocr, geometry)] : native
      setMatches(findInSegments(segs, query))
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    registry,
    descriptor.sourceId,
    descriptor.srcIndex,
    descriptor.id,
    geometry.displayWidthCss,
    geometry.rotation,
    query,
    editor.state.ocrData,
  ])

  // Bring the active match into view once it's rendered.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', inline: 'center' })
  }, [activeLocalIndex, matches])

  if (!query || matches.length === 0) return null

  return (
    <div class="search-hl-layer" style={{ width: W, height: H }}>
      {matches.map((m, mi) =>
        m.rects.map((r, ri) => (
          <div
            key={`${mi}:${ri}`}
            ref={mi === activeLocalIndex && ri === 0 ? activeRef : undefined}
            class={`search-hl${mi === activeLocalIndex ? ' search-hl--active' : ''}`}
            style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
          />
        )),
      )}
    </div>
  )
}
