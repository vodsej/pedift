import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectFields, applyFormValues, flattenDocument } from '../../../src/core/forms'
import { EditorDocument } from '../../../src/core/document'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

describe('forms', () => {
  it('detects text/checkbox/dropdown fields', async () => {
    const fields = await detectFields(fixture('form.pdf'))
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
    expect(byName['name'].type).toBe('text')
    expect(byName['subscribe'].type).toBe('checkbox')
    expect(byName['plan'].type).toBe('dropdown')
    expect(byName['plan'].options).toEqual(['Free', 'Pro', 'Team'])
  })

  it('fills field values that round-trip', async () => {
    const out = await applyFormValues(
      fixture('form.pdf'),
      undefined,
      { name: 'Alice', subscribe: true, plan: 'Pro' },
      { flatten: false },
    )
    const fields = await detectFields(out)
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
    expect(byName['name'].value).toBe('Alice')
    expect(byName['subscribe'].value).toBe(true)
    expect(byName['plan'].value).toBe('Pro')
  })

  it('flatten removes the fillable fields', async () => {
    const out = await applyFormValues(fixture('form.pdf'), undefined, { name: 'Bob' }, { flatten: true })
    const fields = await detectFields(out)
    expect(fields.length).toBe(0)
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(1)
  })

  it('flattenDocument flattens an existing form', async () => {
    const out = await flattenDocument(fixture('form.pdf'))
    expect((await detectFields(out)).length).toBe(0)
  })

  it('returns [] for a PDF with no form', async () => {
    expect(await detectFields(fixture('plain-3page.pdf'))).toEqual([])
  })
})

describe('page numbers + watermark (finalize passes)', () => {
  it('page numbers produce a valid, larger PDF', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    const plain = await editor.build()
    editor.setPageNumbers({
      position: 'bottom-center',
      format: 'long',
      startAt: 1,
      range: null,
      fontSize: 12,
      color: '#333333',
    })
    const withNums = await editor.build()
    const reloaded = await PDFDocument.load(withNums)
    expect(reloaded.getPageCount()).toBe(3)
    expect(withNums.length).toBeGreaterThan(plain.length)
  })

  it('watermark produces a valid PDF', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    editor.setWatermark({ text: 'CONFIDENTIAL', color: '#ff0000', opacity: 0.2, fontSize: 48, range: null })
    const out = await editor.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('protect produces a PDF that needs the password', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    editor.setProtect({ userPassword: 'sesame' })
    const out = await editor.build()
    await expect(PDFDocument.load(out)).rejects.toThrow()
    const ok = await PDFDocument.load(out, { password: 'sesame' })
    expect(ok.getPageCount()).toBe(3)
  })
})
