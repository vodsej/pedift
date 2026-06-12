import { describe, it, expect } from 'vitest'
import { findInSegments, type SearchSegment } from '../../../src/render/search'

const box = (x: number, w: number) => ({ x, y: 0, width: w, height: 10 })

describe('findInSegments', () => {
  it('returns nothing for an empty query', () => {
    const segs: SearchSegment[] = [{ str: 'Hello', box: box(0, 50) }]
    expect(findInSegments(segs, '')).toEqual([])
  })

  it('finds a substring within a single segment with a proportional rect', () => {
    // 11 chars over 110px ⇒ 10px/char. "world" = chars [6,11).
    const segs: SearchSegment[] = [{ str: 'Hello world', box: box(0, 110) }]
    const m = findInSegments(segs, 'world')
    expect(m).toHaveLength(1)
    expect(m[0].rects).toHaveLength(1)
    expect(m[0].rects[0].x).toBeCloseTo(60)
    expect(m[0].rects[0].width).toBeCloseTo(50)
    expect(m[0].rects[0].y).toBe(0)
    expect(m[0].rects[0].height).toBe(10)
  })

  it('is case-insensitive', () => {
    const segs: SearchSegment[] = [{ str: 'Hello', box: box(0, 50) }]
    expect(findInSegments(segs, 'hello')).toHaveLength(1)
    expect(findInSegments(segs, 'HELLO')).toHaveLength(1)
  })

  it('spans a match across two segments, one rect per segment', () => {
    const segs: SearchSegment[] = [
      { str: 'foo', box: box(0, 30) }, // 10px/char
      { str: 'bar', box: box(30, 30) },
    ]
    const m = findInSegments(segs, 'oobar') // foo[1,3) + bar[0,3)
    expect(m).toHaveLength(1)
    expect(m[0].rects).toHaveLength(2)
    expect(m[0].rects[0].x).toBeCloseTo(10)
    expect(m[0].rects[0].width).toBeCloseTo(20)
    expect(m[0].rects[1].x).toBeCloseTo(30)
    expect(m[0].rects[1].width).toBeCloseTo(30)
  })

  it('matches across a non-highlightable (null-box) separator segment', () => {
    const segs: SearchSegment[] = [
      { str: 'foo', box: box(0, 30) },
      { str: ' ', box: null }, // a space item contributes to text but draws nothing
      { str: 'bar', box: box(40, 30) },
    ]
    const m = findInSegments(segs, 'foo bar')
    expect(m).toHaveLength(1)
    // only the two boxed segments yield rects
    expect(m[0].rects).toHaveLength(2)
    expect(m[0].rects[0].x).toBeCloseTo(0)
    expect(m[0].rects[1].x).toBeCloseTo(40)
  })

  it('finds every occurrence', () => {
    const segs: SearchSegment[] = [{ str: 'aXaXa', box: box(0, 50) }]
    expect(findInSegments(segs, 'a')).toHaveLength(3)
  })

  it('counts non-overlapping occurrences', () => {
    const segs: SearchSegment[] = [{ str: 'aaaa', box: box(0, 40) }]
    expect(findInSegments(segs, 'aa')).toHaveLength(2)
  })

  it('returns no matches when the query is absent', () => {
    const segs: SearchSegment[] = [{ str: 'Hello world', box: box(0, 110) }]
    expect(findInSegments(segs, 'zzz')).toEqual([])
  })
})
