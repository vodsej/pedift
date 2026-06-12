import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures')
const OCR_HTML = path.resolve(__dirname, '../../dist/pedift-ocr.html')

const WORKER_SRC = `file://${path.resolve(__dirname, '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`

// ─── helpers (copied from smoke.spec.ts — keep in sync) ──────────────────────

async function openPdfViaChooser(page: import('@playwright/test').Page, filePath: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.dropzone').first().click(),
  ])
  await chooser.setFiles(filePath)
}

async function waitForCanvas(page: import('@playwright/test').Page) {
  const canvas = page.locator('.pagecanvas__canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  return canvas
}

/** Open Document menu in the workspace. */
async function openDocMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Document', exact: true }).click()
}

/** Extract all text from a PDF byte buffer using pdfjs-dist legacy in Node. */
async function extractPdfText(bytes: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  })
  const doc = await task.promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i)
    const content = await pg.getTextContent()
    text += content.items.map((it: { str: string }) => it.str).join(' ')
  }
  return text
}

// ─── OCR e2e ─────────────────────────────────────────────────────────────────

test('ocr: scanned.pdf becomes text-searchable after OCR run', async ({ page }) => {
  test.skip(!fs.existsSync(OCR_HTML), 'pedift-ocr.html not built (run npm run build:ocr)')
  // OCR of one page takes 3-8 s; give ample headroom for slow CI machines.
  test.setTimeout(120_000)

  await page.goto('/pedift-ocr.html')

  // 1. Open the scanned PDF fixture (no text layer — pure image page)
  await openPdfViaChooser(page, path.join(FIXTURES, 'scanned.pdf'))
  await waitForCanvas(page)

  // 2. Open the Document menu and click OCR…
  await openDocMenu(page)
  await page.getByRole('menuitem', { name: /^OCR/i }).click()

  // 3. The OCR dialog must appear
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // 4. Wait for scanned-page detection to finish — the "Run OCR" button starts
  //    disabled and becomes enabled once detection completes.
  const runBtn = dialog.getByRole('button', { name: 'Run OCR' })
  await expect(runBtn).toBeEnabled({ timeout: 30_000 })

  // 5. Click Run OCR
  await runBtn.click()

  // 6. Wait for the dialog to close — the dialog closing is the reliable signal
  //    that OCR succeeded (it closes on success and shows a toast).
  await expect(dialog).not.toBeVisible({ timeout: 90_000 })

  // 6.5. In-app: the recognized text is now selectable over the scanned page.
  //      SelectableTextLayer (Select tool, the default) renders invisible
  //      .ocr-word spans straight from editor.state.ocrData — no save needed.
  const ocrWords = page.locator('.selectable-text-layer .ocr-word')
  await expect.poll(() => ocrWords.count(), { timeout: 15_000 }).toBeGreaterThan(0)
  const selectedInApp = await page.evaluate(() => {
    const layer = document.querySelector('.selectable-text-layer')
    if (!layer) return ''
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(layer)
    sel?.removeAllRanges()
    sel?.addRange(range)
    return sel?.toString() ?? ''
  })
  // Proves the OCR spans are real selectable text (accuracy is asserted via the
  // saved-PDF extraction below); require at least one high-confidence token.
  const inAppLower = selectedInApp.toLowerCase()
  const inAppTokens = ['invoice', '12345', 'fox', 'customer'].filter((t) => inAppLower.includes(t)).length
  expect(
    inAppTokens,
    `in-app OCR selection had ${inAppTokens} tokens: ${selectedInApp.slice(0, 200)}`,
  ).toBeGreaterThanOrEqual(1)

  // 7. Save: set up download listener BEFORE clicking, then save.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /save/i }).click()
  const download = await downloadPromise

  const filePath = await download.path()
  expect(filePath).not.toBeNull()

  const bytes = fs.readFileSync(filePath!)

  // 8. Sanity: valid PDF header
  expect(bytes.length).toBeGreaterThan(500)
  expect(bytes.slice(0, 5).toString('ascii')).toBe('%PDF-')

  // 9. The OCR'd page must now contain extractable text.
  //    We pin high-confidence tokens: digits and clear words the tesseract
  //    engine reliably recognises from the scanned fixture.
  const text = await extractPdfText(bytes)
  console.log('[ocr.spec] extracted text:', text)

  // Assert high-confidence tokens are present (case-insensitive).
  // All four were reliably produced by tesseract on the scanned fixture:
  //   SCANNED DOCUMENT | Invoice Number 12345 | Customer: Acme Corporation |
  //   This page has no text layer. | Total Due 9876 USD |
  //   The quick brown fox jumps over the lazy dog.
  const lower = text.toLowerCase()
  const hasInvoice = lower.includes('invoice')
  const has12345 = text.includes('12345')
  const hasFox = lower.includes('fox')
  const hasCustomer = lower.includes('customer')

  // Require ≥3 of the four tokens so a single OCR mis-read doesn't fail the suite,
  // but the bar is high enough to prove the page actually became searchable.
  const tokenCount = [hasInvoice, has12345, hasFox, hasCustomer].filter(Boolean).length
  expect(
    tokenCount,
    `Expected ≥3 OCR tokens, got ${tokenCount}. Extracted text: ${text.slice(0, 400)}`,
  ).toBeGreaterThanOrEqual(3)
})
