import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import { useSourceDoc } from './hooks/useSourceDoc'
import { PdfPageCanvas } from './PdfPageCanvas'
import { Spinner } from './components/Spinner'
import type { ComponentChildren } from 'preact'

interface Props {
  registry: RenderRegistry
  descriptor: PageDescriptor
  cssWidth: number
  /** Overlay layer rendered on top of the page (Phase 3). */
  children?: ComponentChildren
}

/** Main editing surface: renders a page descriptor and hosts the overlay layer. */
export function PageStage({ registry, descriptor, cssWidth, children }: Props) {
  const doc = useSourceDoc(registry, descriptor.sourceId)

  if (!doc) {
    return (
      <div class="pagecanvas pagecanvas--placeholder" style={{ width: cssWidth }}>
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div class="stage__page">
      <PdfPageCanvas
        doc={doc}
        pageNumber={descriptor.srcIndex + 1}
        cssWidth={cssWidth}
        rotation={descriptor.rotation}
      />
      {children}
    </div>
  )
}
