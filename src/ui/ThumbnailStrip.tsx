import { useEffect, useRef, useState } from 'preact/hooks'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderThumbnail } from '../render/thumbnail'

interface Props {
  doc: PDFDocumentProxy
  numPages: number
  current: number // 1-based
  onSelect: (page: number) => void
}

const THUMB_WIDTH = 140

export function ThumbnailStrip({ doc, numPages, current, onSelect }: Props) {
  return (
    <div class="thumbs" role="listbox" aria-label="Pages">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
        <Thumb key={n} doc={doc} pageNumber={n} active={n === current} onSelect={onSelect} />
      ))}
    </div>
  )
}

function Thumb({
  doc,
  pageNumber,
  active,
  onSelect,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  active: boolean
  onSelect: (p: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(pageNumber <= 8)

  // Lazily render thumbnails as they scroll into view.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const run = async () => {
      const canvas = ref.current
      if (!canvas) return
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return
        await renderThumbnail(page, canvas, THUMB_WIDTH)
      } catch {
        /* ignore */
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [visible, doc, pageNumber])

  useEffect(() => {
    if (active) wrapRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <button
      ref={wrapRef}
      type="button"
      class={`thumb ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(pageNumber)}
      aria-selected={active}
      role="option"
    >
      <span class="thumb__frame">
        <canvas ref={ref} class="thumb__canvas" />
      </span>
      <span class="thumb__num">{pageNumber}</span>
    </button>
  )
}
