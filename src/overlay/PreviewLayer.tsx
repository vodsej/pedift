import type { EditorDocument } from '../core/document'
import type { PageDescriptor, PageNumbersConfig } from '../core/types'
import {
  pdfToView,
  rectPdfToView,
  ptsToCss,
  displayHeightCss,
  type PageGeometry,
} from './geometry'

// Non-interactive live preview of document-level effects that are otherwise only
// applied at save time: watermark, page numbers, and the crop region. The math
// mirrors src/core/watermark.ts, pageNumbers.ts and the CropBox bake so the
// preview matches the downloaded file (WYSIWYG).

interface Props {
  editor: EditorDocument
  descriptor: PageDescriptor
  geometry: PageGeometry
  /** 0-based index of this page in the working document (for numbering + ranges). */
  pageIndex: number
  /** Suppress the crop dim while the interactive crop tool is active. */
  showCrop: boolean
}

let measureCtx: CanvasRenderingContext2D | null = null
function measureText(text: string, sizePx: number, weight = ''): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * sizePx * 0.5
  measureCtx.font = `${weight} ${sizePx}px Helvetica, Arial, sans-serif`.trim()
  return measureCtx.measureText(text).width
}

function pageNumberLabel(n: number, total: number, cfg: PageNumbersConfig): string {
  if (cfg.format === 'slash') return `${n} / ${total}`
  if (cfg.format === 'long') return `Page ${n} of ${total}`
  return String(n)
}

function inRange(i: number, range: [number, number] | null, total: number): boolean {
  const [from, to] = range ?? [0, total - 1]
  return i >= from && i <= to
}

export function PreviewLayer({ editor, descriptor, geometry: g, pageIndex, showCrop }: Props) {
  const state = editor.state
  const W = g.displayWidthCss
  const H = displayHeightCss(g)
  const total = editor.pageCount

  // --- watermark ---
  let watermark = null
  if (state.watermark && state.watermark.text.trim() && inRange(pageIndex, state.watermark.range, total)) {
    const cfg = state.watermark
    const wPts = g.pageWidthPts
    const hPts = g.pageHeightPts
    const diagPts = Math.hypot(wPts, hPts)
    let sizePts = cfg.fontSize
    const measured = measureText(cfg.text, sizePts, 'bold')
    if (measured > diagPts * 0.9) sizePts = (sizePts * diagPts * 0.9) / measured
    const sizeCss = ptsToCss(g, sizePts)
    const angleDeg = (Math.atan2(H, W) * 180) / Math.PI
    watermark = (
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${-angleDeg}deg)`,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: sizeCss,
          color: cfg.color,
          opacity: cfg.opacity,
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        {cfg.text}
      </div>
    )
  }

  // --- page numbers (computed in unrotated PDF coords like the bake, then mapped) ---
  let pageNumber = null
  if (state.pageNumbers && inRange(pageIndex, state.pageNumbers.range, total)) {
    const cfg = state.pageNumbers
    const [from] = cfg.range ?? [0, total - 1]
    const label = pageNumberLabel(cfg.startAt + (pageIndex - from), total, cfg)
    const wPts = g.pageWidthPts
    const hPts = g.pageHeightPts
    const margin = 28
    const size = cfg.fontSize
    const textWPts = measureText(label, size)
    let x = margin
    if (cfg.position.endsWith('center')) x = (wPts - textWPts) / 2
    else if (cfg.position.endsWith('right')) x = wPts - margin - textWPts
    const y = cfg.position.startsWith('top') ? hPts - margin - size : margin
    const anchor = pdfToView(g, x, y)
    pageNumber = (
      <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={W} height={H}>
        <text
          x={anchor.x}
          y={anchor.y}
          transform={`rotate(${g.rotation} ${anchor.x} ${anchor.y})`}
          font-family="Helvetica, Arial, sans-serif"
          font-size={ptsToCss(g, size)}
          fill={cfg.color}
        >
          {label}
        </text>
      </svg>
    )
  }

  // --- crop dim (area outside the CropBox) ---
  let crop = null
  if (showCrop && descriptor.crop) {
    const r = rectPdfToView(g, descriptor.crop)
    const band = (style: Record<string, number>) => (
      <div class="crop-shade" style={{ position: 'absolute', ...style }} />
    )
    crop = (
      <>
        {band({ left: 0, top: 0, width: W, height: Math.max(0, r.y) })}
        {band({ left: 0, top: r.y + r.height, width: W, height: Math.max(0, H - r.y - r.height) })}
        {band({ left: 0, top: r.y, width: Math.max(0, r.x), height: r.height })}
        {band({ left: r.x + r.width, top: r.y, width: Math.max(0, W - r.x - r.width), height: r.height })}
        <div class="crop-preview-outline" style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height }} />
      </>
    )
  }

  if (!watermark && !pageNumber && !crop) return null

  return (
    <div class="preview-layer" style={{ width: W, height: H }}>
      {watermark}
      {pageNumber}
      {crop}
    </div>
  )
}
