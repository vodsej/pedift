import { useState, useRef, useEffect, useCallback } from 'preact/hooks'
import type { JSX } from 'preact'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { SegmentedControl, TextInput } from '../components/controls'
import { t } from '../../strings'
import { addSignature, getSignatures } from '../signatureStore'
import '../styles/annotate.css'

export interface SignatureDialogProps {
  onClose: () => void
  onConfirm: (pngBytes: Uint8Array, aspect: number) => void
}

type Mode = 'draw' | 'type'

const CANVAS_W = 440
const CANVAS_H = 180
const INK = '#1a1a1a'

/** Returns the tight bounding box of non-transparent pixels, or null if all transparent. */
function getTightBounds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } | null {
  const data = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = 0, maxY = 0
  let found = false
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3]
      if (alpha > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        found = true
      }
    }
  }
  if (!found) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function renderTypeText(canvas: HTMLCanvasElement, text: string) {
  const dpr = window.devicePixelRatio || 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!text) return
  const cssW = canvas.width / dpr
  const cssH = canvas.height / dpr
  ctx.save()
  ctx.scale(dpr, dpr)
  const fontSize = Math.min(64, cssH * 0.55)
  ctx.font = `${fontSize}px 'Segoe Script','Brush Script MT',cursive`
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cssW / 2, cssH / 2, cssW - 24)
  ctx.restore()
}

export function SignatureDialog(props: SignatureDialogProps): JSX.Element {
  const { onClose, onConfirm } = props
  const savedSigs = getSignatures()
  const [mode, setMode] = useState<Mode>('draw')
  const [typeText, setTypeText] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const [busy, setBusy] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)

  // Set up backing store size once on mount / dpr change
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }, [])

  useEffect(() => {
    setupCanvas()
  }, [setupCanvas])

  // Re-render typed text whenever mode switches to type or text changes
  useEffect(() => {
    if (mode === 'type') {
      const canvas = canvasRef.current
      if (!canvas) return
      renderTypeText(canvas, typeText)
      setIsEmpty(typeText.trim() === '')
    }
  }, [mode, typeText])

  // ── Drawing handlers ─────────────────────────────────────────────────────

  const getPoint = (e: PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    }
  }

  const handlePointerDown = (e: PointerEvent) => {
    if (mode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const pt = getPoint(e)
    lastPtRef.current = pt
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, (dpr * 1.25) / 2, 0, Math.PI * 2)
    ctx.fillStyle = INK
    ctx.fill()
    setIsEmpty(false)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!drawingRef.current || mode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const pt = getPoint(e)
    const last = lastPtRef.current ?? pt
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.strokeStyle = INK
    ctx.lineWidth = 2.5 * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPtRef.current = pt
  }

  const handlePointerUp = () => {
    drawingRef.current = false
    lastPtRef.current = null
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (mode === 'type') {
      setTypeText('')
    }
    setIsEmpty(true)
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return
    const w = canvas.width
    const h = canvas.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bounds = getTightBounds(ctx, w, h)
    if (!bounds) return

    const tmp = document.createElement('canvas')
    tmp.width = bounds.w
    tmp.height = bounds.h
    const tmpCtx = tmp.getContext('2d')
    if (!tmpCtx) return
    tmpCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h)

    const aspect = bounds.w / bounds.h
    const dataUrl = tmp.toDataURL('image/png')
    setBusy(true)
    tmp.toBlob((blob) => {
      if (!blob) { setBusy(false); return }
      blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf)
        addSignature({ dataUrl, bytes, aspect })
        onConfirm(bytes, aspect)
        setBusy(false)
        onClose()
      }).catch(() => setBusy(false))
    }, 'image/png')
  }

  // ── Mode switch — clear canvas when toggling ──────────────────────────────

  const handleModeChange = (m: Mode) => {
    setMode(m)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    if (m === 'type') {
      setTypeText('')
    }
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
      <Button
        variant="primary"
        disabled={isEmpty || busy}
        onClick={handleConfirm}
      >
        {t.dialogs.signature.useButton}
      </Button>
    </>
  )

  return (
    <Dialog
      title={t.dialogs.signature.title}
      onClose={onClose}
      footer={footer}
      size="md"
    >
      {savedSigs.length > 0 && (
        <div class="sig-reuse">
          <span class="sig-reuse__label">{t.dialogs.signature.reuse}</span>
          <div class="sig-reuse__list">
            {savedSigs.map((s, i) => (
              <button
                key={i}
                type="button"
                class="sig-reuse__thumb"
                aria-label={t.dialogs.signature.reuse}
                onClick={() => { onConfirm(s.bytes, s.aspect); onClose() }}
              >
                <img src={s.dataUrl} alt="" style={{ height: '40px', width: 'auto', display: 'block' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="sig-modeswitch">
        <SegmentedControl<Mode>
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: 'draw', label: t.dialogs.signature.draw },
            { value: 'type', label: t.dialogs.signature.type },
          ]}
        />
      </div>

      {mode === 'type' && (
        <div class="sig-type-input">
          <TextInput
            placeholder={t.dialogs.signature.typePlaceholder}
            value={typeText}
            onInput={(e) => setTypeText((e.target as HTMLInputElement).value)}
            autofocus
          />
        </div>
      )}

      <div class="sig-canvas-wrap">
        <canvas
          ref={canvasRef}
          class={`sig-canvas${mode === 'type' ? ' sig-canvas--type' : ''}`}
          style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={mode === 'draw' ? t.dialogs.signature.draw : t.dialogs.signature.type}
        />
      </div>

      <div class="sig-clear-row">
        <Button variant="ghost" size="sm" onClick={handleClear}>
          {t.dialogs.signature.clear}
        </Button>
      </div>
    </Dialog>
  )
}
