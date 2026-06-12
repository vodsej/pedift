import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'
import type { OcrPageData, PageDescriptor } from '../../core/types'
import type { RenderRegistry } from '../../render/registry'
import { buildPageSegments } from '../../render/textLayer'
import { findInSegments, type SearchSegment } from '../../render/search'
import { ocrWordToPdfRect } from '../../core/ocr'
import { rectPdfToView, type PageGeometry } from '../../overlay/geometry'

/** A single match located in document order, addressed by page + its index on that page. */
export interface FlatMatch {
  pageId: string
  pageIndex: number
  /** Index of this match within its page's match list (aligns the highlight layer). */
  localIndex: number
}

export interface SearchApi {
  open: boolean
  /** Open/close the find bar; bumps `focusNonce` each time it's (re)opened. */
  setOpen: (v: boolean) => void
  focusNonce: number
  requestFocus: () => void
  query: string
  setQuery: (v: string) => void
  /** Debounced, trimmed query actually used for matching/highlighting. */
  effectiveQuery: string
  matches: FlatMatch[]
  active: number
  activeMatch: FlatMatch | null
  next: () => void
  prev: () => void
  busy: boolean
}

const DEBOUNCE_MS = 180

/**
 * OCR words as search segments, in word order. With `geometry` the boxes are
 * real (current page, for highlighting); without it boxes are null (other pages,
 * indexing only). A trailing space after each word lets phrases match across
 * words. Kept here (not in render) because OCR→view geometry is a UI concern.
 */
export function ocrSegments(ocr: OcrPageData, geometry: PageGeometry | null): SearchSegment[] {
  const out: SearchSegment[] = []
  for (const w of ocr.words) {
    if (!w.text) continue
    const box = geometry ? rectPdfToView(geometry, ocrWordToPdfRect(w, ocr)) : null
    out.push({ str: w.text, box })
    out.push({ str: ' ', box: null })
  }
  return out
}

export function useSearch(editor: EditorDocument, registry: RenderRegistry): SearchApi {
  const [open, setOpenState] = useState(false)
  const [focusNonce, setFocusNonce] = useState(0)
  const [query, setQuery] = useState('')
  const [effectiveQuery, setEffectiveQuery] = useState('')
  const [matches, setMatches] = useState<FlatMatch[]>([])
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)

  // Cache native text extraction per source page (the expensive pdf.js step).
  const cache = useRef(new Map<string, SearchSegment[]>())
  const cacheVersion = useRef(registry.version)

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v)
    if (v) setFocusNonce((n) => n + 1)
    else {
      setQuery('')
      setEffectiveQuery('')
    }
  }, [])
  const requestFocus = useCallback(() => setFocusNonce((n) => n + 1), [])

  // Debounce the raw query into the one used for matching.
  useEffect(() => {
    const id = setTimeout(() => setEffectiveQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const pages = editor.pages
  const ocrData = editor.state.ocrData

  // Rebuild the whole-document match index when the query (or document) changes.
  useEffect(() => {
    if (!open || !effectiveQuery) {
      setMatches([])
      setActive(0)
      setBusy(false)
      return
    }
    // Drop cached extraction if a source's bytes were reopened (fill-forms/flatten).
    if (cacheVersion.current !== registry.version) {
      cache.current.clear()
      cacheVersion.current = registry.version
    }
    let cancelled = false
    setBusy(true)
    void (async () => {
      const flat: FlatMatch[] = []
      for (let p = 0; p < pages.length; p++) {
        const pd = pages[p]
        const native = await getNativeSegments(registry, cache.current, pd)
        if (cancelled) return
        const ocr = ocrData?.[pd.id]
        const segs = ocr ? [...native, ...ocrSegments(ocr, null)] : native
        const found = findInSegments(segs, effectiveQuery)
        for (let i = 0; i < found.length; i++) {
          flat.push({ pageId: pd.id, pageIndex: p, localIndex: i })
        }
      }
      if (cancelled) return
      setMatches(flat)
      setActive(0)
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, effectiveQuery, pages, ocrData, registry, registry.version])

  const next = useCallback(
    () => setActive((a) => (matches.length ? (a + 1) % matches.length : 0)),
    [matches.length],
  )
  const prev = useCallback(
    () => setActive((a) => (matches.length ? (a - 1 + matches.length) % matches.length : 0)),
    [matches.length],
  )

  return {
    open,
    setOpen,
    focusNonce,
    requestFocus,
    query,
    setQuery,
    effectiveQuery,
    matches,
    active,
    activeMatch: matches[active] ?? null,
    next,
    prev,
    busy,
  }
}

async function getNativeSegments(
  registry: RenderRegistry,
  cache: Map<string, SearchSegment[]>,
  pd: PageDescriptor,
): Promise<SearchSegment[]> {
  const key = `${pd.sourceId}:${pd.srcIndex}`
  const hit = cache.get(key)
  if (hit) return hit
  const doc = await registry.get(pd.sourceId)
  const page = await doc.getPage(pd.srcIndex + 1)
  // Strings are scale/rotation independent; boxes are unused for indexing.
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  const segs = await buildPageSegments(page, viewport, 1)
  cache.set(key, segs)
  return segs
}
