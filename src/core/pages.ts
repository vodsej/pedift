import type { PageDescriptor, Rotation } from './types'
import { nextId } from './ids'

// Pure operations on the page list. They never mutate inputs — each returns a new
// array — so they are trivially unit-testable and snapshot-friendly for undo/redo.

export function normalizeRotation(deg: number): Rotation {
  const n = (((Math.round(deg / 90) * 90) % 360) + 360) % 360
  return n as Rotation
}

/** Move the pages identified by `ids` so they sit before `toIndex` (in the original array's indexing). */
export function movePages(
  pages: PageDescriptor[],
  ids: string[],
  toIndex: number,
): PageDescriptor[] {
  const idSet = new Set(ids)
  const moving = pages.filter((p) => idSet.has(p.id))
  if (moving.length === 0) return pages
  const rest = pages.filter((p) => !idSet.has(p.id))

  // Count how many non-moving items precede toIndex to find the insertion point in `rest`.
  let insertAt = 0
  for (let i = 0; i < toIndex && i < pages.length; i++) {
    if (!idSet.has(pages[i].id)) insertAt++
  }
  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)]
}

/** Simple single-item move from index `from` to index `to`. */
export function movePage(pages: PageDescriptor[], from: number, to: number): PageDescriptor[] {
  if (from < 0 || from >= pages.length) return pages
  const copy = pages.slice()
  const [item] = copy.splice(from, 1)
  const clamped = Math.max(0, Math.min(copy.length, to))
  copy.splice(clamped, 0, item)
  return copy
}

export function rotatePages(
  pages: PageDescriptor[],
  ids: string[],
  deltaDeg: number,
): PageDescriptor[] {
  const idSet = new Set(ids)
  return pages.map((p) =>
    idSet.has(p.id) ? { ...p, rotation: normalizeRotation(p.rotation + deltaDeg) } : p,
  )
}

export function deletePages(pages: PageDescriptor[], ids: string[]): PageDescriptor[] {
  const idSet = new Set(ids)
  const remaining = pages.filter((p) => !idSet.has(p.id))
  // Never produce an empty document.
  return remaining.length === 0 ? pages : remaining
}

/** Duplicate each selected page, placing the copy immediately after the original. */
export function duplicatePages(pages: PageDescriptor[], ids: string[]): PageDescriptor[] {
  const idSet = new Set(ids)
  const out: PageDescriptor[] = []
  for (const p of pages) {
    out.push(p)
    if (idSet.has(p.id)) out.push({ ...p, id: nextId('pg') })
  }
  return out
}

/** Insert new descriptors at `atIndex` (clamped). */
export function insertPagesAt(
  pages: PageDescriptor[],
  atIndex: number,
  inserted: PageDescriptor[],
): PageDescriptor[] {
  const clamped = Math.max(0, Math.min(pages.length, atIndex))
  return [...pages.slice(0, clamped), ...inserted, ...pages.slice(clamped)]
}

export function setCrop(
  pages: PageDescriptor[],
  ids: string[],
  crop: PageDescriptor['crop'],
): PageDescriptor[] {
  const idSet = new Set(ids)
  return pages.map((p) => (idSet.has(p.id) ? { ...p, crop } : p))
}

/** Build descriptors for `count` pages of a source, reading initial rotations. */
export function descriptorsForSource(
  sourceId: string,
  count: number,
  rotationOf: (index: number) => number = () => 0,
): PageDescriptor[] {
  return Array.from({ length: count }, (_, i) => ({
    id: nextId('pg'),
    sourceId,
    srcIndex: i,
    rotation: normalizeRotation(rotationOf(i)),
    crop: null,
  }))
}

/** Parse a page-range string like "1-3, 5, 8-10" into 0-based indices within [0,total). */
export function parsePageRanges(input: string, total: number): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (const part of input.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      let a = parseInt(m[1], 10)
      let b = parseInt(m[2], 10)
      if (a > b) [a, b] = [b, a]
      for (let n = a; n <= b; n++) addIndex(n)
    } else if (/^\d+$/.test(trimmed)) {
      addIndex(parseInt(trimmed, 10))
    } else {
      throw new Error(`Invalid range segment: "${trimmed}"`)
    }
  }
  return out

  function addIndex(oneBased: number) {
    const idx = oneBased - 1
    if (idx < 0 || idx >= total) throw new Error(`Page ${oneBased} is out of range`)
    if (!seen.has(idx)) {
      seen.add(idx)
      out.push(idx)
    }
  }
}

/** Split the indices [0,total) into chunks of `n` (the "every N pages" mode). */
export function chunkEveryN(total: number, n: number): number[][] {
  if (n < 1) throw new Error('Pages per file must be at least 1')
  const chunks: number[][] = []
  for (let i = 0; i < total; i += n) {
    chunks.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k))
  }
  return chunks
}
