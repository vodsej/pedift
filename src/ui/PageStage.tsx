import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import type { PageGeometry } from '../overlay/geometry'
import { useSourceDoc } from './hooks/useSourceDoc'
import { PdfPageCanvas } from './PdfPageCanvas'
import { Spinner } from './components/Spinner'

interface Props {
  registry: RenderRegistry
  descriptor: PageDescriptor
  cssWidth: number
  /** Render the overlay layer once the page geometry is known. */
  renderOverlay?: (geometry: PageGeometry) => ComponentChildren
}

/** Main editing surface: renders a page descriptor and hosts the overlay layer. */
export function PageStage({ registry, descriptor, cssWidth, renderOverlay }: Props) {
  const doc = useSourceDoc(registry, descriptor.sourceId)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  // Fetch the unrotated page size (points) to build the overlay geometry.
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    doc
      .getPage(descriptor.srcIndex + 1)
      .then((page) => {
        const vp = page.getViewport({ scale: 1, rotation: 0 })
        if (!cancelled) setSize({ w: vp.width, h: vp.height })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [doc, descriptor.srcIndex])

  if (!doc) {
    return (
      <div class="pagecanvas pagecanvas--placeholder" style={{ width: cssWidth }}>
        <Spinner size={28} />
      </div>
    )
  }

  const geometry: PageGeometry | null = size
    ? {
        pageWidthPts: size.w,
        pageHeightPts: size.h,
        rotation: descriptor.rotation,
        displayWidthCss: cssWidth,
      }
    : null

  return (
    <div class="stage__page" style={{ position: 'relative', width: cssWidth }}>
      <PdfPageCanvas
        doc={doc}
        pageNumber={descriptor.srcIndex + 1}
        cssWidth={cssWidth}
        rotation={descriptor.rotation}
      />
      {geometry && renderOverlay && <div class="overlay-host">{renderOverlay(geometry)}</div>}
    </div>
  )
}
