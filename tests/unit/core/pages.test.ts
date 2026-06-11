import { describe, it, expect, beforeEach } from 'vitest'
import { resetIds } from '../../../src/core/ids'
import {
  normalizeRotation,
  descriptorsForSource,
  movePages,
  movePage,
  rotatePages,
  deletePages,
  duplicatePages,
  insertPagesAt,
  setCrop,
  parsePageRanges,
  chunkEveryN,
} from '../../../src/core/pages'
import type { PageDescriptor } from '../../../src/core/types'

beforeEach(() => {
  resetIds()
})

// Helper: build a quick set of N pages from a source
function makePages(count: number, sourceId = 'src'): PageDescriptor[] {
  return descriptorsForSource(sourceId, count)
}

// ---- normalizeRotation -------------------------------------------------------

describe('normalizeRotation', () => {
  it('returns 0 for 0', () => expect(normalizeRotation(0)).toBe(0))
  it('returns 90 for 90', () => expect(normalizeRotation(90)).toBe(90))
  it('returns 180 for 180', () => expect(normalizeRotation(180)).toBe(180))
  it('returns 270 for 270', () => expect(normalizeRotation(270)).toBe(270))
  it('wraps 360 -> 0', () => expect(normalizeRotation(360)).toBe(0))
  it('wraps 450 -> 90', () => expect(normalizeRotation(450)).toBe(90))
  it('wraps -90 -> 270', () => expect(normalizeRotation(-90)).toBe(270))
  it('wraps -180 -> 180', () => expect(normalizeRotation(-180)).toBe(180))
  it('wraps -270 -> 90', () => expect(normalizeRotation(-270)).toBe(90))
  it('wraps 720 -> 0', () => expect(normalizeRotation(720)).toBe(0))
})

// ---- descriptorsForSource ---------------------------------------------------

describe('descriptorsForSource', () => {
  it('produces the correct count of descriptors', () => {
    const pages = makePages(3)
    expect(pages).toHaveLength(3)
  })

  it('assigns sequential srcIndex values starting at 0', () => {
    const pages = makePages(4)
    expect(pages.map((p) => p.srcIndex)).toEqual([0, 1, 2, 3])
  })

  it('sets rotation from rotationOf callback', () => {
    const pages = descriptorsForSource('s', 3, (i) => i * 90)
    expect(pages[0].rotation).toBe(0)
    expect(pages[1].rotation).toBe(90)
    expect(pages[2].rotation).toBe(180)
  })

  it('normalizes rotation values from callback', () => {
    const pages = descriptorsForSource('s', 2, (i) => [450, -90][i])
    expect(pages[0].rotation).toBe(90)
    expect(pages[1].rotation).toBe(270)
  })

  it('defaults rotation to 0 when no callback provided', () => {
    const pages = makePages(2)
    expect(pages[0].rotation).toBe(0)
    expect(pages[1].rotation).toBe(0)
  })

  it('sets crop to null', () => {
    const pages = makePages(2)
    expect(pages[0].crop).toBeNull()
    expect(pages[1].crop).toBeNull()
  })

  it('assigns sourceId to all pages', () => {
    const pages = descriptorsForSource('my-source', 3)
    expect(pages.every((p) => p.sourceId === 'my-source')).toBe(true)
  })

  it('generates unique ids (deterministic after resetIds)', () => {
    const pages = makePages(3)
    const ids = pages.map((p) => p.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('produces expected deterministic ids after resetIds', () => {
    // counter starts at 0, first call increments to 1 -> pg_1, etc.
    const pages = makePages(3)
    expect(pages[0].id).toBe('pg_1')
    expect(pages[1].id).toBe('pg_2')
    expect(pages[2].id).toBe('pg_3')
  })
})

// ---- movePages --------------------------------------------------------------

describe('movePages', () => {
  it('moves a single page to a lower index', () => {
    const pages = makePages(4)
    const idToMove = pages[3].id
    const result = movePages(pages, [idToMove], 0)
    expect(result[0].id).toBe(idToMove)
    expect(result).toHaveLength(4)
  })

  it('moves a single page to a higher index', () => {
    const pages = makePages(4)
    const idToMove = pages[0].id
    const result = movePages(pages, [idToMove], 4)
    expect(result[3].id).toBe(idToMove)
  })

  it('moves multiple pages preserving relative order among them', () => {
    const pages = makePages(5)
    const ids = [pages[1].id, pages[3].id]
    const result = movePages(pages, ids, 0)
    // The two moved pages should come first and be in original relative order
    expect(result[0].id).toBe(pages[1].id)
    expect(result[1].id).toBe(pages[3].id)
    expect(result).toHaveLength(5)
  })

  it('moving to same position produces equivalent ordering', () => {
    const pages = makePages(3)
    const result = movePages(pages, [pages[1].id], 1)
    expect(result.map((p) => p.id)).toEqual(pages.map((p) => p.id))
  })

  it('returns input unchanged when ids are empty', () => {
    const pages = makePages(3)
    const result = movePages(pages, [], 0)
    expect(result).toBe(pages)
  })

  it('returns input unchanged when no id matches', () => {
    const pages = makePages(3)
    const result = movePages(pages, ['nonexistent'], 0)
    expect(result).toBe(pages)
  })

  it('does not mutate the input array', () => {
    const pages = makePages(4)
    const originalIds = pages.map((p) => p.id)
    movePages(pages, [pages[0].id], 3)
    expect(pages.map((p) => p.id)).toEqual(originalIds)
  })
})

// ---- movePage (single index) ------------------------------------------------

describe('movePage', () => {
  it('moves item from index 2 to index 0', () => {
    const pages = makePages(4)
    const target = pages[2]
    const result = movePage(pages, 2, 0)
    expect(result[0]).toBe(target)
    expect(result).toHaveLength(4)
  })

  it('moves item from index 0 to last', () => {
    const pages = makePages(4)
    const target = pages[0]
    const result = movePage(pages, 0, 10) // clamped to length
    expect(result[3]).toBe(target)
  })

  it('returns input unchanged for out-of-range from', () => {
    const pages = makePages(3)
    expect(movePage(pages, -1, 0)).toBe(pages)
    expect(movePage(pages, 10, 0)).toBe(pages)
  })

  it('does not mutate the input array', () => {
    const pages = makePages(3)
    const snapshot = pages.slice()
    movePage(pages, 0, 2)
    expect(pages).toEqual(snapshot)
  })
})

// ---- rotatePages ------------------------------------------------------------

describe('rotatePages', () => {
  it('rotates targeted pages by 90 degrees', () => {
    const pages = makePages(3)
    const result = rotatePages(pages, [pages[0].id], 90)
    expect(result[0].rotation).toBe(90)
    expect(result[1].rotation).toBe(0)
    expect(result[2].rotation).toBe(0)
  })

  it('rotates multiple pages', () => {
    const pages = makePages(3)
    const result = rotatePages(pages, [pages[0].id, pages[2].id], 180)
    expect(result[0].rotation).toBe(180)
    expect(result[1].rotation).toBe(0)
    expect(result[2].rotation).toBe(180)
  })

  it('wraps 270 + 90 -> 0', () => {
    const pages = descriptorsForSource('s', 1, () => 270)
    const result = rotatePages(pages, [pages[0].id], 90)
    expect(result[0].rotation).toBe(0)
  })

  it('handles negative delta: 0 - 90 -> 270', () => {
    const pages = makePages(1)
    const result = rotatePages(pages, [pages[0].id], -90)
    expect(result[0].rotation).toBe(270)
  })

  it('ignores unknown ids', () => {
    const pages = makePages(2)
    const result = rotatePages(pages, ['unknown'], 90)
    expect(result[0].rotation).toBe(0)
    expect(result[1].rotation).toBe(0)
  })

  it('does not mutate inputs', () => {
    const pages = makePages(2)
    const origRotations = pages.map((p) => p.rotation)
    rotatePages(pages, [pages[0].id], 90)
    expect(pages.map((p) => p.rotation)).toEqual(origRotations)
  })
})

// ---- deletePages ------------------------------------------------------------

describe('deletePages', () => {
  it('removes the specified pages', () => {
    const pages = makePages(4)
    const result = deletePages(pages, [pages[1].id])
    expect(result).toHaveLength(3)
    expect(result.find((p) => p.id === pages[1].id)).toBeUndefined()
  })

  it('removes multiple pages', () => {
    const pages = makePages(4)
    const result = deletePages(pages, [pages[0].id, pages[2].id])
    expect(result).toHaveLength(2)
  })

  it('returns original array when deleting all pages (guard against empty doc)', () => {
    const pages = makePages(2)
    const result = deletePages(pages, pages.map((p) => p.id))
    expect(result).toBe(pages)
  })

  it('returns original array unchanged when no ids match', () => {
    const pages = makePages(2)
    const result = deletePages(pages, ['nonexistent'])
    expect(result).toEqual(pages)
  })

  it('does not mutate the input', () => {
    const pages = makePages(3)
    const snapshot = pages.map((p) => p.id)
    deletePages(pages, [pages[0].id])
    expect(pages.map((p) => p.id)).toEqual(snapshot)
  })
})

// ---- duplicatePages ---------------------------------------------------------

describe('duplicatePages', () => {
  it('inserts a copy immediately after the original', () => {
    const pages = makePages(3)
    const targetId = pages[1].id
    const result = duplicatePages(pages, [targetId])
    expect(result).toHaveLength(4)
    // Original at index 1, copy at index 2
    expect(result[1].id).toBe(targetId)
    expect(result[2].id).not.toBe(targetId)
    expect(result[2].srcIndex).toBe(result[1].srcIndex)
  })

  it('assigns a new unique id to the duplicate', () => {
    const pages = makePages(2)
    const allIdsBefore = pages.map((p) => p.id)
    const result = duplicatePages(pages, [pages[0].id])
    const newId = result[1].id
    expect(allIdsBefore).not.toContain(newId)
  })

  it('duplicate id uniqueness across all resulting pages', () => {
    const pages = makePages(4)
    const result = duplicatePages(pages, [pages[0].id, pages[2].id])
    const ids = result.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('duplicates multiple pages in correct positions', () => {
    const pages = makePages(3)
    // duplicate pages[0] and pages[2]
    const result = duplicatePages(pages, [pages[0].id, pages[2].id])
    expect(result).toHaveLength(5)
    // Original page[0] at 0, copy at 1; original page[1] at 2; original page[2] at 3, copy at 4
    expect(result[0].id).toBe(pages[0].id)
    expect(result[1].srcIndex).toBe(pages[0].srcIndex)
    expect(result[2].id).toBe(pages[1].id)
    expect(result[3].id).toBe(pages[2].id)
    expect(result[4].srcIndex).toBe(pages[2].srcIndex)
  })

  it('does not mutate the original array', () => {
    const pages = makePages(3)
    const snapshot = pages.map((p) => p.id)
    duplicatePages(pages, [pages[0].id])
    expect(pages.map((p) => p.id)).toEqual(snapshot)
  })
})

// ---- insertPagesAt ----------------------------------------------------------

describe('insertPagesAt', () => {
  it('inserts at the beginning (index 0)', () => {
    const pages = makePages(3)
    const newPage = descriptorsForSource('other', 1)[0]
    const result = insertPagesAt(pages, 0, [newPage])
    expect(result[0]).toBe(newPage)
    expect(result).toHaveLength(4)
  })

  it('inserts at the end', () => {
    const pages = makePages(3)
    const newPage = descriptorsForSource('other', 1)[0]
    const result = insertPagesAt(pages, 3, [newPage])
    expect(result[3]).toBe(newPage)
    expect(result).toHaveLength(4)
  })

  it('inserts in the middle', () => {
    const pages = makePages(3)
    const newPage = descriptorsForSource('other', 1)[0]
    const result = insertPagesAt(pages, 1, [newPage])
    expect(result[1]).toBe(newPage)
    expect(result).toHaveLength(4)
  })

  it('clamps negative atIndex to 0', () => {
    const pages = makePages(2)
    const newPage = descriptorsForSource('other', 1)[0]
    const result = insertPagesAt(pages, -5, [newPage])
    expect(result[0]).toBe(newPage)
  })

  it('clamps large atIndex to length', () => {
    const pages = makePages(2)
    const newPage = descriptorsForSource('other', 1)[0]
    const result = insertPagesAt(pages, 100, [newPage])
    expect(result[2]).toBe(newPage)
  })

  it('does not mutate the input', () => {
    const pages = makePages(2)
    const snapshot = pages.slice()
    insertPagesAt(pages, 1, [descriptorsForSource('x', 1)[0]])
    expect(pages).toEqual(snapshot)
  })
})

// ---- setCrop ----------------------------------------------------------------

describe('setCrop', () => {
  const crop = { x: 10, y: 20, width: 100, height: 200 }

  it('sets crop on the targeted pages', () => {
    const pages = makePages(3)
    const result = setCrop(pages, [pages[0].id, pages[2].id], crop)
    expect(result[0].crop).toEqual(crop)
    expect(result[1].crop).toBeNull()
    expect(result[2].crop).toEqual(crop)
  })

  it('sets crop to null (clear crop)', () => {
    const pages = makePages(2)
    const withCrop = setCrop(pages, [pages[0].id], crop)
    const cleared = setCrop(withCrop, [withCrop[0].id], null)
    expect(cleared[0].crop).toBeNull()
  })

  it('does not mutate input', () => {
    const pages = makePages(2)
    setCrop(pages, [pages[0].id], crop)
    expect(pages[0].crop).toBeNull()
  })
})

// ---- parsePageRanges --------------------------------------------------------

describe('parsePageRanges', () => {
  it('parses a single page number', () => {
    expect(parsePageRanges('1', 5)).toEqual([0])
    expect(parsePageRanges('5', 5)).toEqual([4])
  })

  it('parses a range', () => {
    expect(parsePageRanges('1-3', 5)).toEqual([0, 1, 2])
  })

  it('parses mixed pages and ranges', () => {
    expect(parsePageRanges('1-3, 5', 5)).toEqual([0, 1, 2, 4])
  })

  it('deduplicates overlapping indices', () => {
    const result = parsePageRanges('1-3, 2-4', 5)
    expect(result).toEqual([0, 1, 2, 3])
    expect(new Set(result).size).toBe(result.length)
  })

  it('handles reversed range notation "3-1"', () => {
    const result = parsePageRanges('3-1', 5)
    expect(result).toEqual([0, 1, 2])
  })

  it('ignores empty segments from trailing comma', () => {
    expect(parsePageRanges('1,2,', 5)).toEqual([0, 1])
  })

  it('throws on page number out of range (too high)', () => {
    expect(() => parsePageRanges('6', 5)).toThrow()
  })

  it('throws on page number 0 (out of range)', () => {
    expect(() => parsePageRanges('0', 5)).toThrow()
  })

  it('throws on range that exceeds total', () => {
    expect(() => parsePageRanges('1-6', 5)).toThrow()
  })

  it('throws on invalid segment text', () => {
    expect(() => parsePageRanges('a-b', 5)).toThrow()
  })

  it('preserves order from input string', () => {
    expect(parsePageRanges('3, 1, 2', 5)).toEqual([2, 0, 1])
  })
})

// ---- chunkEveryN ------------------------------------------------------------

describe('chunkEveryN', () => {
  it('basic chunking: chunkEveryN(7, 3) -> [[0,1,2],[3,4,5],[6]]', () => {
    expect(chunkEveryN(7, 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]])
  })

  it('exact multiple: chunkEveryN(6, 3) -> [[0,1,2],[3,4,5]]', () => {
    expect(chunkEveryN(6, 3)).toEqual([[0, 1, 2], [3, 4, 5]])
  })

  it('n=1 produces single-element arrays', () => {
    expect(chunkEveryN(3, 1)).toEqual([[0], [1], [2]])
  })

  it('n >= total returns single chunk with all indices', () => {
    expect(chunkEveryN(3, 10)).toEqual([[0, 1, 2]])
  })

  it('total=0 returns empty array', () => {
    expect(chunkEveryN(0, 3)).toEqual([])
  })

  it('throws when n < 1', () => {
    expect(() => chunkEveryN(5, 0)).toThrow()
    expect(() => chunkEveryN(5, -1)).toThrow()
  })
})
