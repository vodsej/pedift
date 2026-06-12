// Pure in-document text search: match a query against a sequence of text
// segments and produce highlight rectangles. No DOM, no pdf.js — segments are
// supplied by the render/UI layers (native pdf.js text items + OCR words), so
// this stays trivially unit-testable.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface SearchSegment {
  /** The segment's text (joined verbatim to reconstruct the page's reading text). */
  str: string
  /**
   * Highlight box in CSS px over the page (top-left origin), or null for
   * non-drawable segments (whitespace, synthetic line breaks). Null segments
   * still contribute their text to matching — they just produce no rectangle.
   */
  box: Rect | null
}

export interface SearchMatch {
  /** One rect per segment the match touches (a match can wrap items/lines). */
  rects: Rect[]
}

/**
 * Find every (case-insensitive, non-overlapping) occurrence of `query` in the
 * concatenated segment text, mapping each occurrence back to highlight rects.
 * Within a touched segment the rect is sub-divided proportionally by character
 * count along the box width (exact for left-to-right horizontal text).
 */
export function findInSegments(segments: SearchSegment[], query: string): SearchMatch[] {
  if (!query) return []

  let text = ''
  const segStart: number[] = []
  for (const seg of segments) {
    segStart.push(text.length)
    text += seg.str
  }

  const hay = text.toLowerCase()
  const needle = query.toLowerCase()
  const matches: SearchMatch[] = []
  let from = 0
  for (;;) {
    const idx = hay.indexOf(needle, from)
    if (idx < 0) break
    const end = idx + needle.length
    matches.push({ rects: rectsForRange(segments, segStart, idx, end) })
    from = end // non-overlapping (needle is non-empty here)
  }
  return matches
}

function rectsForRange(
  segments: SearchSegment[],
  segStart: number[],
  start: number,
  end: number,
): Rect[] {
  const rects: Rect[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const len = seg.str.length
    if (!seg.box || len === 0) continue
    const a = segStart[i]
    const b = a + len
    const lo = Math.max(start, a)
    const hi = Math.min(end, b)
    if (hi <= lo) continue
    const f0 = (lo - a) / len
    const f1 = (hi - a) / len
    rects.push({
      x: seg.box.x + seg.box.width * f0,
      y: seg.box.y,
      width: seg.box.width * (f1 - f0),
      height: seg.box.height,
    })
  }
  return rects
}
