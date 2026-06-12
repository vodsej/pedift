import { nextId } from '../core/ids'
import type {
  CropBox,
  OverlayObject,
  ShapeObj,
  StandardFontName,
  TextObj,
} from '../core/types'
import type { ToolOptions } from './tools'

// Overlay object factories + geometry helpers. All coordinates are PDF points in
// the unrotated page space (the layer converts view<->pdf via geometry.ts).

export function nextZ(objects: OverlayObject[]): number {
  return objects.reduce((m, o) => Math.max(m, o.z), 0) + 1
}

export function newText(pageId: string, rect: CropBox, opts: ToolOptions, z: number): TextObj {
  return {
    id: nextId('ov'),
    pageId,
    z,
    type: 'text',
    x: rect.x,
    y: rect.y,
    width: Math.max(rect.width, 40),
    height: Math.max(rect.height, opts.fontSize * 1.4),
    text: '',
    fontSize: opts.fontSize,
    font: opts.font,
    color: opts.color,
    align: 'left',
  }
}

export function newWhiteout(pageId: string, rect: CropBox, opts: ToolOptions, z: number): OverlayObject {
  return { id: nextId('ov'), pageId, z, type: 'whiteout', ...rect, color: opts.whiteoutColor }
}

export function newRedaction(pageId: string, rect: CropBox, opts: ToolOptions, z: number): OverlayObject {
  return { id: nextId('ov'), pageId, z, type: 'redaction', ...rect, color: opts.redactionColor }
}

export function newShape(
  pageId: string,
  shape: ShapeObj['shape'],
  geom: { x: number; y: number; width: number; height: number },
  opts: ToolOptions,
  z: number,
): ShapeObj {
  return {
    id: nextId('ov'),
    pageId,
    z,
    type: 'shape',
    shape,
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    color: opts.color,
    strokeWidth: opts.strokeWidth,
    fill: opts.fill,
  }
}

export function newPen(
  pageId: string,
  points: Array<[number, number]>,
  opts: ToolOptions,
  z: number,
): OverlayObject {
  return {
    id: nextId('ov'),
    pageId,
    z,
    type: 'pen',
    points,
    color: opts.color,
    strokeWidth: opts.strokeWidth,
  }
}

export function newHighlight(
  pageId: string,
  rects: CropBox[],
  opts: ToolOptions,
  z: number,
): OverlayObject {
  return { id: nextId('ov'), pageId, z, type: 'highlight', rects, color: opts.highlightColor, opacity: 0.4 }
}

export function newImage(
  pageId: string,
  rect: CropBox,
  imageKey: string,
  format: 'png' | 'jpg',
  z: number,
): OverlayObject {
  return { id: nextId('ov'), pageId, z, type: 'image', ...rect, imageKey, format }
}

export function newSignature(pageId: string, rect: CropBox, imageKey: string, z: number): OverlayObject {
  return { id: nextId('ov'), pageId, z, type: 'signature', ...rect, imageKey }
}

export function newStamp(
  pageId: string,
  rect: CropBox,
  text: string,
  color: string,
  fontSize: number,
  z: number,
): OverlayObject {
  return { id: nextId('ov'), pageId, z, type: 'stamp', ...rect, text, color, fontSize }
}

/** Axis-aligned bounds of any object, in PDF points. */
export function boundsOf(obj: OverlayObject): CropBox {
  switch (obj.type) {
    case 'pen': {
      const xs = obj.points.map((p) => p[0])
      const ys = obj.points.map((p) => p[1])
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    }
    case 'highlight': {
      const x = Math.min(...obj.rects.map((r) => r.x))
      const y = Math.min(...obj.rects.map((r) => r.y))
      const x2 = Math.max(...obj.rects.map((r) => r.x + r.width))
      const y2 = Math.max(...obj.rects.map((r) => r.y + r.height))
      return { x, y, width: x2 - x, height: y2 - y }
    }
    case 'shape':
      // line/arrow use signed width/height; normalize the bbox.
      return {
        x: Math.min(obj.x, obj.x + obj.width),
        y: Math.min(obj.y, obj.y + obj.height),
        width: Math.abs(obj.width),
        height: Math.abs(obj.height),
      }
    default:
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
  }
}

export function translateObj(obj: OverlayObject, dx: number, dy: number): OverlayObject {
  switch (obj.type) {
    case 'pen':
      return { ...obj, points: obj.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
    case 'highlight':
      return { ...obj, rects: obj.rects.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy })) }
    default:
      return { ...obj, x: obj.x + dx, y: obj.y + dy }
  }
}

/** Resize an object to a new axis-aligned bounds (PDF points), scaling its geometry. */
export function setBounds(obj: OverlayObject, nb: CropBox): OverlayObject {
  const ob = boundsOf(obj)
  const sx = ob.width ? nb.width / ob.width : 1
  const sy = ob.height ? nb.height / ob.height : 1
  const sp = (px: number, py: number): [number, number] => [
    nb.x + (px - ob.x) * sx,
    nb.y + (py - ob.y) * sy,
  ]
  switch (obj.type) {
    case 'pen':
      return { ...obj, points: obj.points.map(([x, y]) => sp(x, y)) }
    case 'highlight':
      return {
        ...obj,
        rects: obj.rects.map((r) => {
          const [x1, y1] = sp(r.x, r.y)
          const [x2, y2] = sp(r.x + r.width, r.y + r.height)
          return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
        }),
      }
    case 'shape':
      if (obj.shape === 'line' || obj.shape === 'arrow') {
        const [x1, y1] = sp(obj.x, obj.y)
        const [x2, y2] = sp(obj.x + obj.width, obj.y + obj.height)
        return { ...obj, x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
      }
      return { ...obj, x: nb.x, y: nb.y, width: nb.width, height: nb.height }
    default:
      return { ...obj, x: nb.x, y: nb.y, width: nb.width, height: nb.height }
  }
}

export const STD_FONTS: StandardFontName[] = ['Helvetica', 'TimesRoman', 'Courier']
