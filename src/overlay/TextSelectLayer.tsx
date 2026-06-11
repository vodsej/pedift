import { useEffect, useState } from 'preact/hooks'
import type { EditorDocument } from '../core/document'
import type { PageDescriptor } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import { getTextItemBoxes, type TextItemBox } from '../render/textLayer'
import {
  rectViewToPdf,
  cssToPts,
  displayHeightCss,
  rotatedSizePts,
  type PageGeometry,
} from './geometry'
import { nextZ, newWhiteout, newText } from './model'
import { defaultToolOptions } from './tools'
import { toast } from '../ui/toast'
import { t } from '../strings/en'

const NOTE_KEY = 'pedift.replaceTextNoteSeen'

interface Props {
  editor: EditorDocument
  registry: RenderRegistry
  descriptor: PageDescriptor
  geometry: PageGeometry
  onReplaced: (textId: string) => void
}

/** Replace-text tool: click an existing text run → whiteout it + drop an editable text box. */
export function TextSelectLayer({ editor, registry, descriptor, geometry, onReplaced }: Props) {
  const [boxes, setBoxes] = useState<TextItemBox[]>([])
  const W = geometry.displayWidthCss
  const H = displayHeightCss(geometry)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const doc = await registry.get(descriptor.sourceId)
      const page = await doc.getPage(descriptor.srcIndex + 1)
      const dpr = window.devicePixelRatio || 1
      const rotW = rotatedSizePts(geometry).w
      const scale = (geometry.displayWidthCss / rotW) * dpr
      const viewport = page.getViewport({ scale, rotation: geometry.rotation })
      const b = await getTextItemBoxes(page, viewport, dpr)
      if (!cancelled) setBoxes(b)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [registry, descriptor.sourceId, descriptor.srcIndex, geometry.displayWidthCss, geometry.rotation])

  const pick = (box: TextItemBox) => {
    const pageId = descriptor.id
    const bg = sampleBackground(box) ?? '#ffffff'
    const existing = editor.overlaysFor(pageId)
    const z = nextZ(existing)
    const rectPdf = rectViewToPdf(geometry, {
      x: box.x - 1,
      y: box.y - 1,
      width: box.width + 2,
      height: box.height + 2,
    })
    const opts = {
      ...defaultToolOptions(),
      whiteoutColor: bg,
      color: '#000000',
      font: 'Helvetica' as const,
      fontSize: Math.max(6, cssToPts(geometry, box.height) * 0.92),
    }
    const whiteout = newWhiteout(pageId, rectPdf, opts, z)
    const textObj = { ...newText(pageId, rectPdf, opts, z + 1), text: box.str }
    editor.setOverlays(pageId, [...existing, whiteout, textObj])

    if (!safeGet(NOTE_KEY)) {
      toast.info(t.dialogs.replaceText.note, 7000)
      safeSet(NOTE_KEY, '1')
    }
    onReplaced(textObj.id)
  }

  return (
    <div class="textselect" style={{ width: W, height: H }}>
      {boxes.map((b, i) => (
        <div
          key={i}
          class="textselect__run"
          style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
          title={b.str}
          onClick={() => pick(b)}
        />
      ))}
    </div>
  )
}

/** Sample the page background colour just above a text run (for a matched whiteout). */
function sampleBackground(box: TextItemBox): string | null {
  try {
    const canvas = document.querySelector(
      '.stage__page canvas.pagecanvas__canvas',
    ) as HTMLCanvasElement | null
    if (!canvas) return null
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    const dpr = window.devicePixelRatio || 1
    const x = Math.round((box.x + box.width / 2) * dpr)
    const y = Math.round(Math.max(0, box.y - 3) * dpr)
    const d = ctx.getImageData(Math.min(x, canvas.width - 1), Math.min(y, canvas.height - 1), 1, 1).data
    if (d[3] === 0) return '#ffffff'
    return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}
