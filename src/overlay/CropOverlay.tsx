import { useRef, useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import { rectViewToPdf, displayHeightCss, type PageGeometry, type ViewRect } from './geometry'
import { t } from '../strings'

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Drag =
  | { mode: 'move'; sx: number; sy: number; orig: ViewRect }
  | { mode: 'resize'; corner: Corner; fixed: { x: number; y: number } }

interface Props {
  geometry: PageGeometry
  editor: EditorDocument
  pageId: string
  onDone: () => void
}

export function CropOverlay({ geometry: g, editor, pageId, onDone }: Props) {
  const W = g.displayWidthCss
  const H = displayHeightCss(g)
  const inset = (v: number) => v * 0.08
  const [rect, setRect] = useState<ViewRect>({ x: inset(W), y: inset(H), width: W - inset(W) * 2, height: H - inset(H) * 2 })
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  const rel = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: clamp(e.clientX - r.left, 0, W), y: clamp(e.clientY - r.top, 0, H) }
  }

  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = rel(e)
    if (d.mode === 'move') {
      const nx = clamp(d.orig.x + (p.x - d.sx), 0, W - d.orig.width)
      const ny = clamp(d.orig.y + (p.y - d.sy), 0, H - d.orig.height)
      setRect({ ...d.orig, x: nx, y: ny })
    } else {
      setRect(norm(d.fixed, p))
    }
  }
  const end = (e: PointerEvent) => {
    ref.current?.releasePointerCapture(e.pointerId)
    drag.current = null
  }

  const apply = (all: boolean) => {
    const crop = rectViewToPdf(g, rect)
    const ids = all ? editor.pages.map((p) => p.id) : [pageId]
    editor.setCropOn(ids, crop)
    onDone()
  }

  const handles: Array<{ c: Corner; x: number; y: number }> = [
    { c: 'nw', x: rect.x, y: rect.y },
    { c: 'ne', x: rect.x + rect.width, y: rect.y },
    { c: 'sw', x: rect.x, y: rect.y + rect.height },
    { c: 'se', x: rect.x + rect.width, y: rect.y + rect.height },
  ]

  return (
    <div ref={ref} class="cropoverlay" style={{ width: W, height: H }} onPointerMove={onMove} onPointerUp={end}>
      {/* dimmed area outside the crop rect (4 bands) */}
      <div class="crop-shade" style={{ left: 0, top: 0, width: W, height: rect.y }} />
      <div class="crop-shade" style={{ left: 0, top: rect.y + rect.height, width: W, height: H - rect.y - rect.height }} />
      <div class="crop-shade" style={{ left: 0, top: rect.y, width: rect.x, height: rect.height }} />
      <div class="crop-shade" style={{ left: rect.x + rect.width, top: rect.y, width: W - rect.x - rect.width, height: rect.height }} />

      <div
        class="crop-rect"
        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        onPointerDown={(e) => {
          ref.current?.setPointerCapture(e.pointerId)
          drag.current = { mode: 'move', sx: rel(e as unknown as PointerEvent).x, sy: rel(e as unknown as PointerEvent).y, orig: rect }
        }}
      />
      {handles.map((h) => (
        <div
          key={h.c}
          class="crop-handle"
          style={{ left: h.x, top: h.y }}
          onPointerDown={(e) => {
            e.stopPropagation()
            ref.current?.setPointerCapture(e.pointerId)
            const fixed = {
              x: h.c === 'nw' || h.c === 'sw' ? rect.x + rect.width : rect.x,
              y: h.c === 'nw' || h.c === 'ne' ? rect.y + rect.height : rect.y,
            }
            drag.current = { mode: 'resize', corner: h.c, fixed }
          }}
        />
      ))}

      <div class="crop-bar">
        <span class="crop-bar__hint">{t.dialogs.crop.hint}</span>
        <button class="btn btn--sm btn--secondary" onClick={() => apply(false)}>{t.dialogs.crop.thisPage}</button>
        <button class="btn btn--sm btn--primary" onClick={() => apply(true)}>{t.dialogs.crop.allPages}</button>
        <button class="btn btn--sm btn--ghost" onClick={onDone}>{t.common.cancel}</button>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
function norm(a: { x: number; y: number }, b: { x: number; y: number }): ViewRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}
