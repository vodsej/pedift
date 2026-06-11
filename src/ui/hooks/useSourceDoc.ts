import { useEffect, useState } from 'preact/hooks'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { RenderRegistry } from '../../render/registry'

/** Resolves (and caches) the pdf.js document for a source id. */
export function useSourceDoc(
  registry: RenderRegistry,
  sourceId: string,
): PDFDocumentProxy | null {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)

  useEffect(() => {
    let cancelled = false
    setDoc(null)
    registry
      .get(sourceId)
      .then((d) => {
        if (!cancelled) setDoc(d)
      })
      .catch(() => {
        /* surfaced elsewhere */
      })
    return () => {
      cancelled = true
    }
    // registry.version changes on evict (after rebase) so we re-resolve fresh bytes.
  }, [registry, sourceId, registry.version])

  return doc
}
