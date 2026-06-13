import type { StandardFontName } from '../core/types'

export type ToolId =
  | 'select'
  | 'text'
  | 'replaceText'
  | 'whiteout'
  | 'redaction'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'pen'
  | 'highlight'
  | 'image'
  | 'signature'
  | 'stamp'

export interface ToolOptions {
  color: string
  fill: string | null // null = no fill
  strokeWidth: number // PDF points
  fontSize: number // PDF points
  font: StandardFontName
  align: 'left' | 'center' | 'right'
  highlightColor: string
  whiteoutColor: string
  redactionColor: string
  stampColor: string
  stampFontSize: number // PDF points
}

export function defaultToolOptions(): ToolOptions {
  return {
    color: '#d8453a',
    fill: null,
    strokeWidth: 2,
    fontSize: 16,
    font: 'Helvetica',
    align: 'left',
    highlightColor: '#ffd23f',
    whiteoutColor: '#ffffff',
    redactionColor: '#000000',
    stampColor: '#c0392b',
    stampFontSize: 28,
  }
}

/** Tools that draw by dragging a rectangle. */
export const RECT_DRAW_TOOLS: ToolId[] = ['text', 'whiteout', 'redaction', 'rect', 'ellipse']
/** Tools that draw by dragging a line (start -> end). */
export const LINE_DRAW_TOOLS: ToolId[] = ['line', 'arrow']

/** A request to drop a ready-made object (image/signature/stamp) centered on the page. */
export type InsertRequest =
  | { kind: 'image'; imageKey: string; format: 'png' | 'jpg'; aspect: number }
  | { kind: 'signature'; imageKey: string; aspect: number }
  | { kind: 'stamp'; text: string; color: string; fontSize: number }
