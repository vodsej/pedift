import { useEffect, useRef, useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import type { CropBox, OverlayObject } from '../core/types'
import {
  pdfToView,
  viewToPdf,
  rectPdfToView,
  rectViewToPdf,
  ptsToCss,
  displayHeightCss,
  type PageGeometry,
  type ViewRect,
} from './geometry'
import {
  boundsOf,
  translateObj,
  setBounds,
  nextZ,
  newText,
  newWhiteout,
  newRedaction,
  newShape,
  newPen,
  newHighlight,
  newImage,
  newSignature,
  newStamp,
} from './model'
import {
  RECT_DRAW_TOOLS,
  LINE_DRAW_TOOLS,
  type ToolId,
  type ToolOptions,
  type InsertRequest,
} from './tools'

interface Props {
  editor: EditorDocument
  pageId: string
  geometry: PageGeometry
  tool: ToolId
  options: ToolOptions
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  /** Called after a draw tool places an object (so the toolbar can return to select). */
  onPlaced: () => void
  /** A pending image/signature/stamp to drop centered on the page. */
  insertRequest: InsertRequest | null
  onInsertConsumed: () => void
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Gesture =
  | { mode: 'create'; start: { x: number; y: number } }
  | { mode: 'pen'; pts: Array<[number, number]> }
  | { mode: 'move'; orig: OverlayObject; start: { x: number; y: number }; captured: boolean }
  | { mode: 'resize'; orig: OverlayObject; corner: Corner; fixed: { x: number; y: number } }

export function OverlayLayer({
  editor,
  pageId,
  geometry: g,
  tool,
  options,
  selectedId,
  setSelectedId,
  onPlaced,
  insertRequest,
  onInsertConsumed,
}: Props) {
  const objects = editor.overlaysFor(pageId)
  const layerRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const [draft, setDraft] = useState<OverlayObject | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const imgUrls = useRef<Map<string, string>>(new Map())

  const W = g.displayWidthCss
  const H = displayHeightCss(g)

  useEffect(() => {
    const urls = imgUrls.current
    return () => {
      for (const u of urls.values()) URL.revokeObjectURL(u)
      urls.clear()
    }
  }, [])

  const imageUrl = (key: string, format: 'png' | 'jpg'): string | null => {
    const cached = imgUrls.current.get(key)
    if (cached) return cached
    const asset = editor.getImage(key)
    if (!asset) return null
    const url = URL.createObjectURL(new Blob([asset.bytes.slice().buffer as ArrayBuffer], { type: format === 'png' ? 'image/png' : 'image/jpeg' }))
    imgUrls.current.set(key, url)
    return url
  }

  const rel = (e: PointerEvent): { x: number; y: number } => {
    const r = layerRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const commit = (obj: OverlayObject) => {
    const exists = objects.some((o) => o.id === obj.id)
    editor.setOverlays(pageId, exists ? objects.map((o) => (o.id === obj.id ? obj : o)) : [...objects, obj])
  }
  const removeObj = (id: string) => {
    editor.setOverlays(pageId, objects.filter((o) => o.id !== id))
  }

  // delete key + escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return
      const tgt = e.target as HTMLElement
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        removeObj(selectedId)
        setSelectedId(null)
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingId, objects])

  // Drop a ready-made image/signature/stamp centered on the page.
  useEffect(() => {
    if (!insertRequest) return
    const z = nextZ(objects)
    const pageW = g.pageWidthPts
    const pageH = g.pageHeightPts
    let obj: OverlayObject
    if (insertRequest.kind === 'stamp') {
      const wp = Math.min(pageW * 0.6, insertRequest.fontSize * Math.max(3, insertRequest.text.length) * 0.62 + 16)
      const hp = insertRequest.fontSize * 1.5
      const rect: CropBox = { x: (pageW - wp) / 2, y: (pageH - hp) / 2, width: wp, height: hp }
      obj = newStamp(pageId, rect, insertRequest.text, insertRequest.color, insertRequest.fontSize, z)
    } else {
      const aspect = insertRequest.aspect || 1
      let wp = pageW * 0.4
      let hp = wp / aspect
      if (hp > pageH * 0.4) {
        hp = pageH * 0.4
        wp = hp * aspect
      }
      const rect: CropBox = { x: (pageW - wp) / 2, y: (pageH - hp) / 2, width: wp, height: hp }
      obj =
        insertRequest.kind === 'image'
          ? newImage(pageId, rect, insertRequest.imageKey, insertRequest.format, z)
          : newSignature(pageId, rect, insertRequest.imageKey, z)
    }
    commit(obj)
    setSelectedId(obj.id)
    onInsertConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertRequest])

  // ---- gesture handling ----
  const onPointerDown = (e: PointerEvent) => {
    if (editingId) return
    const p = rel(e)
    layerRef.current?.setPointerCapture(e.pointerId)

    if (tool === 'select') {
      setSelectedId(null)
      return
    }
    if (tool === 'pen') {
      gestureRef.current = { mode: 'pen', pts: [[p.x, p.y]] }
      return
    }
    gestureRef.current = { mode: 'create', start: p }
    setSelectedId(null)
  }

  const onPointerMove = (e: PointerEvent) => {
    const gx = gestureRef.current
    if (!gx) return
    const p = rel(e)

    if (gx.mode === 'pen') {
      gx.pts.push([p.x, p.y])
      const pdfPts = gx.pts.map(([x, y]) => {
        const q = viewToPdf(g, x, y)
        return [q.x, q.y] as [number, number]
      })
      setDraft(newPen(pageId, pdfPts, options, nextZ(objects)))
      return
    }
    if (gx.mode === 'create') {
      setDraft(buildFromDrag(gx.start, p))
      return
    }
    if (gx.mode === 'move') {
      // Capture only once a real drag starts, so a plain click/double-click on a
      // text box still reaches its dblclick handler (capture would steal it).
      if (!gx.captured && (Math.abs(p.x - gx.start.x) > 2 || Math.abs(p.y - gx.start.y) > 2)) {
        layerRef.current?.setPointerCapture(e.pointerId)
        gx.captured = true
      }
      if (!gx.captured) return
      const a = viewToPdf(g, gx.start.x, gx.start.y)
      const b = viewToPdf(g, p.x, p.y)
      setDraft(translateObj(gx.orig, b.x - a.x, b.y - a.y))
      return
    }
    if (gx.mode === 'resize') {
      const view: ViewRect = normRect(gx.fixed, p)
      setDraft(setBounds(gx.orig, rectViewToPdf(g, view)))
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    try {
      if (layerRef.current?.hasPointerCapture(e.pointerId)) {
        layerRef.current.releasePointerCapture(e.pointerId)
      }
    } catch {
      /* not captured */
    }
    const gx = gestureRef.current
    gestureRef.current = null
    const d = draft
    setDraft(null)
    if (!gx) return

    if (gx.mode === 'create') {
      // For text, a click (tiny drag) still places a default-size box.
      const p = rel(e)
      const tinyTextDefault =
        tool === 'text' && Math.abs(p.x - gx.start.x) < 4 && Math.abs(p.y - gx.start.y) < 4
      const obj = tinyTextDefault ? buildFromDrag(gx.start, { x: gx.start.x + 160, y: gx.start.y + 28 }) : d
      if (obj) {
        commit(obj)
        setSelectedId(obj.id)
        if (obj.type === 'text') setEditingId(obj.id)
      }
      onPlaced()
      return
    }
    if (gx.mode === 'pen') {
      if (d && d.type === 'pen' && d.points.length > 1) {
        commit(d)
        setSelectedId(d.id)
      }
      onPlaced()
      return
    }
    if ((gx.mode === 'move' || gx.mode === 'resize') && d) {
      commit(d)
    }
  }

  const buildFromDrag = (start: { x: number; y: number }, cur: { x: number; y: number }): OverlayObject | null => {
    const z = nextZ(objects)
    if (RECT_DRAW_TOOLS.includes(tool)) {
      const rectPdf = rectViewToPdf(g, normRect(start, cur))
      if (tool === 'text') return newText(pageId, rectPdf, options, z)
      if (tool === 'whiteout') return newWhiteout(pageId, rectPdf, options, z)
      if (tool === 'redaction') return newRedaction(pageId, rectPdf, options, z)
      if (tool === 'rect') return newShape(pageId, 'rect', rectPdf, options, z)
      if (tool === 'ellipse') return newShape(pageId, 'ellipse', rectPdf, options, z)
    }
    if (tool === 'highlight') {
      const rectPdf = rectViewToPdf(g, normRect(start, cur))
      return newHighlight(pageId, [rectPdf], options, z)
    }
    if (LINE_DRAW_TOOLS.includes(tool)) {
      const a = viewToPdf(g, start.x, start.y)
      const b = viewToPdf(g, cur.x, cur.y)
      return newShape(pageId, tool === 'arrow' ? 'arrow' : 'line', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }, options, z)
    }
    return null
  }

  const startMove = (e: PointerEvent, obj: OverlayObject) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelectedId(obj.id)
    gestureRef.current = { mode: 'move', orig: obj, start: rel(e), captured: false }
  }

  const startResize = (e: PointerEvent, obj: OverlayObject, corner: Corner) => {
    e.stopPropagation()
    layerRef.current?.setPointerCapture(e.pointerId)
    const vb = rectPdfToView(g, boundsOf(obj))
    // The fixed point is the corner opposite the dragged handle.
    const fixed = {
      x: corner === 'nw' || corner === 'sw' ? vb.x + vb.width : vb.x,
      y: corner === 'nw' || corner === 'ne' ? vb.y + vb.height : vb.y,
    }
    gestureRef.current = { mode: 'resize', orig: obj, corner, fixed }
  }

  // Objects to render: committed list with the active draft overriding/added.
  const renderList: OverlayObject[] = draft
    ? objects.some((o) => o.id === draft.id)
      ? objects.map((o) => (o.id === draft.id ? draft : o))
      : [...objects, draft]
    : objects
  const ordered = [...renderList].sort((a, b) => a.z - b.z)

  return (
    <div
      ref={layerRef}
      class={`overlay ${tool === 'select' ? 'overlay--select' : 'overlay--draw'}`}
      style={{ width: W, height: H }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {ordered.map((obj) => (
        <ObjectView
          key={obj.id}
          obj={obj}
          g={g}
          selected={obj.id === selectedId && tool === 'select'}
          editing={obj.id === editingId}
          tool={tool}
          imageUrl={imageUrl}
          onPointerDownObj={(e) => startMove(e, obj)}
          onStartResize={(e, c) => startResize(e, obj, c)}
          onDoubleClick={() => obj.type === 'text' && tool === 'select' && (setSelectedId(obj.id), setEditingId(obj.id))}
          onEditCommit={(text) => {
            setEditingId(null)
            if (obj.type === 'text') {
              if (text.trim() === '') {
                removeObj(obj.id)
                setSelectedId(null)
              } else {
                commit({ ...obj, text })
              }
            }
          }}
        />
      ))}
    </div>
  )
}

function normRect(a: { x: number; y: number }, b: { x: number; y: number }): ViewRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

// Approximate the standard PDF fonts on screen so wrapping/alignment roughly match the bake.
const FONT_CSS: Record<string, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  TimesRoman: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
}

interface ObjectViewProps {
  obj: OverlayObject
  g: PageGeometry
  selected: boolean
  editing: boolean
  tool: ToolId
  imageUrl: (key: string, format: 'png' | 'jpg') => string | null
  onPointerDownObj: (e: PointerEvent) => void
  onStartResize: (e: PointerEvent, corner: Corner) => void
  onDoubleClick: () => void
  onEditCommit: (text: string) => void
}

function ObjectView(p: ObjectViewProps) {
  const { obj, g, selected, editing } = p
  const vb = rectPdfToView(g, boundsOf(obj))
  const base: Record<string, string | number> = {
    position: 'absolute',
    left: vb.x,
    top: vb.y,
    width: vb.width,
    height: vb.height,
  }
  const interactive = p.tool === 'select'
  const common = {
    onPointerDown: p.onPointerDownObj,
    onDblClick: p.onDoubleClick,
    style: { ...base, cursor: interactive ? 'move' : 'inherit', pointerEvents: interactive ? 'auto' : 'none' },
  }

  let body
  if (obj.type === 'text') {
    const fontPx = ptsToCss(g, obj.fontSize)
    const fontFamily = FONT_CSS[obj.font]
    if (editing) {
      body = (
        <textarea
          class="overlay-text-edit"
          autofocus
          style={{ ...base, fontSize: fontPx, fontFamily, color: obj.color, textAlign: obj.align, lineHeight: 1.18 }}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => p.onEditCommit((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
          }}
        >
          {obj.text}
        </textarea>
      )
    } else {
      body = (
        <div
          {...common}
          class={`overlay-obj overlay-text ${selected ? 'is-selected' : ''}`}
          style={{ ...common.style, fontSize: fontPx, fontFamily, color: obj.color, textAlign: obj.align, lineHeight: 1.18 }}
        >
          {obj.text || ' '}
        </div>
      )
    }
  } else if (obj.type === 'whiteout') {
    body = <div {...common} class={`overlay-obj ${selected ? 'is-selected' : ''}`} style={{ ...common.style, background: obj.color }} />
  } else if (obj.type === 'redaction') {
    // Editor-only red outline marks a pending redaction (keeps a white bar
    // visible and a black bar distinct from a black shape). Never saved.
    body = (
      <div
        {...common}
        class={`overlay-obj ${selected ? 'is-selected' : ''}`}
        style={{ ...common.style, background: obj.color, outline: '1.5px solid #e11', outlineOffset: '-1.5px' }}
      />
    )
  } else if (obj.type === 'highlight') {
    body = (
      <div {...common} class={`overlay-obj overlay-highlight ${selected ? 'is-selected' : ''}`}>
        {obj.rects.map((r, i) => {
          const rv = rectPdfToView(g, r)
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: rv.x - vb.x,
                top: rv.y - vb.y,
                width: rv.width,
                height: rv.height,
                background: obj.color,
                opacity: obj.opacity,
                mixBlendMode: 'multiply',
              }}
            />
          )
        })}
      </div>
    )
  } else if (obj.type === 'shape') {
    body = <ShapeView obj={obj} g={g} vb={vb} selected={selected} common={common} />
  } else if (obj.type === 'pen') {
    const pts = obj.points.map(([x, y]) => pdfToView(g, x, y)).map((q) => `${q.x - vb.x},${q.y - vb.y}`).join(' ')
    body = (
      <div {...common} class={`overlay-obj ${selected ? 'is-selected' : ''}`}>
        <svg style={{ position: 'absolute', overflow: 'visible' }} width={Math.max(vb.width, 1)} height={Math.max(vb.height, 1)}>
          <polyline points={pts} fill="none" stroke={obj.color} stroke-width={ptsToCss(g, obj.strokeWidth)} stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    )
  } else if (obj.type === 'image' || obj.type === 'signature') {
    const fmt = obj.type === 'image' ? obj.format : 'png'
    const url = p.imageUrl(obj.imageKey, fmt)
    body = (
      <div {...common} class={`overlay-obj ${selected ? 'is-selected' : ''}`}>
        {url && <img src={url} style={{ width: '100%', height: '100%', display: 'block' }} alt="" />}
      </div>
    )
  } else {
    // stamp
    body = (
      <div
        {...common}
        class={`overlay-obj overlay-stamp ${selected ? 'is-selected' : ''}`}
        style={{ ...common.style, color: obj.color, fontSize: ptsToCss(g, obj.fontSize) }}
      >
        {obj.text}
      </div>
    )
  }

  return (
    <>
      {body}
      {selected && !editing && (
        <Handles vb={vb} onStartResize={p.onStartResize} />
      )}
    </>
  )
}

function ShapeView({
  obj,
  g,
  vb,
  selected,
  common,
}: {
  obj: Extract<OverlayObject, { type: 'shape' }>
  g: PageGeometry
  vb: ViewRect
  selected: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  common: any
}) {
  const sw = ptsToCss(g, obj.strokeWidth)
  if (obj.shape === 'rect' || obj.shape === 'ellipse') {
    return (
      <div
        {...common}
        class={`overlay-obj ${selected ? 'is-selected' : ''}`}
        style={{
          ...common.style,
          border: `${sw}px solid ${obj.color}`,
          borderRadius: obj.shape === 'ellipse' ? '50%' : 0,
          background: obj.fill ?? 'transparent',
        }}
      />
    )
  }
  // line / arrow: draw within the bbox svg
  const a = pdfToView(g, obj.x, obj.y)
  const b = pdfToView(g, obj.x + obj.width, obj.y + obj.height)
  const x1 = a.x - vb.x
  const y1 = a.y - vb.y
  const x2 = b.x - vb.x
  const y2 = b.y - vb.y
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.max(8, sw * 3)
  return (
    <div {...common} class={`overlay-obj ${selected ? 'is-selected' : ''}`}>
      <svg style={{ position: 'absolute', overflow: 'visible' }} width={Math.max(vb.width, 1)} height={Math.max(vb.height, 1)}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={obj.color} stroke-width={sw} stroke-linecap="round" />
        {obj.shape === 'arrow' && (
          <>
            <line x1={x2} y1={y2} x2={x2 - head * Math.cos(ang - Math.PI / 7)} y2={y2 - head * Math.sin(ang - Math.PI / 7)} stroke={obj.color} stroke-width={sw} stroke-linecap="round" />
            <line x1={x2} y1={y2} x2={x2 - head * Math.cos(ang + Math.PI / 7)} y2={y2 - head * Math.sin(ang + Math.PI / 7)} stroke={obj.color} stroke-width={sw} stroke-linecap="round" />
          </>
        )}
      </svg>
    </div>
  )
}

function Handles({ vb, onStartResize }: { vb: ViewRect; onStartResize: (e: PointerEvent, c: Corner) => void }) {
  const corners: Array<{ c: Corner; x: number; y: number }> = [
    { c: 'nw', x: vb.x, y: vb.y },
    { c: 'ne', x: vb.x + vb.width, y: vb.y },
    { c: 'sw', x: vb.x, y: vb.y + vb.height },
    { c: 'se', x: vb.x + vb.width, y: vb.y + vb.height },
  ]
  return (
    <>
      <div class="overlay-selbox" style={{ position: 'absolute', left: vb.x, top: vb.y, width: vb.width, height: vb.height }} />
      {corners.map((h) => (
        <div
          key={h.c}
          class="overlay-handle"
          data-corner={h.c}
          style={{ position: 'absolute', left: h.x, top: h.y }}
          onPointerDown={(e) => onStartResize(e as unknown as PointerEvent, h.c)}
        />
      ))}
    </>
  )
}
