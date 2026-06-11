import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures')

// The build renames dist/index.html -> dist/pedift.html, so serve's SPA fallback
// won't kick in.  Navigate to the explicit path.
const APP = '/pedift.html'

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── a. Loads app ─────────────────────────────────────────────────────────────

test('a. loads app: title and drop zone visible', async ({ page }) => {
  await page.goto(APP)
  await expect(page).toHaveTitle(/pedift/i)
  await expect(page.locator('.dropzone').first()).toBeVisible()
})

// ─── b. Open + render ─────────────────────────────────────────────────────────

test('b. open + render: plain-3page.pdf renders canvas and status bar', async ({ page }) => {
  await page.goto(APP)
  await openPdfViaChooser(page, path.join(FIXTURES, 'plain-3page.pdf'))

  const canvas = await waitForCanvas(page)

  // Page actually rendered: bounding box must be substantial
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThan(50)
  expect(box!.height).toBeGreaterThan(50)

  // Status bar shows correct page count
  await expect(page.locator('.stage__statusbar')).toContainText('of 3')
})

// ─── c. Save copy ─────────────────────────────────────────────────────────────

test('c. save copy: download is a valid PDF', async ({ page }) => {
  await page.goto(APP)
  await openPdfViaChooser(page, path.join(FIXTURES, 'plain-3page.pdf'))
  await waitForCanvas(page)

  // Set up download listener BEFORE clicking Save
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /save/i }).click()
  const download = await downloadPromise

  const filePath = await download.path()
  expect(filePath).not.toBeNull()

  const data = fs.readFileSync(filePath!)
  expect(data.length).toBeGreaterThan(500)
  const header = data.slice(0, 5).toString('ascii')
  expect(header).toBe('%PDF-')
})

// ─── d. Password dialog ───────────────────────────────────────────────────────

test('d. password: wrong password shows error, correct password opens document', async ({ page }) => {
  await page.goto(APP)
  await openPdfViaChooser(page, path.join(FIXTURES, 'encrypted.pdf'))

  // Password dialog must appear
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Type wrong password and click Unlock
  await dialog.locator('input[type="password"]').fill('wrong')
  await dialog.getByRole('button', { name: /unlock/i }).click()

  // Error should appear
  await expect(page.locator('.form-error')).toBeVisible({ timeout: 10_000 })

  // Dialog may close and re-open; wait for it to be visible again
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  // Now type correct password
  await dialog.locator('input[type="password"]').fill('test1234')
  await dialog.getByRole('button', { name: /unlock/i }).click()

  // Workspace should render
  await waitForCanvas(page)
  await expect(page.locator('.stage__statusbar')).toContainText('of 1')
})

// ─── e. file:// worker-offline check (THE CRITICAL ONE) ───────────────────────

test('e. file:// worker-offline: pdf.js worker runs with no worker/blob console errors', async ({ page }) => {
  const distHtml = path.resolve(__dirname, '../../dist/pedift.html')

  // Collect console errors and page errors matching worker/blob patterns
  const workerErrors: string[] = []
  const workerPatterns = [/worker/i, /blob:/i, /Failed to fetch/i, /importScripts/i]

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (workerPatterns.some((re) => re.test(text))) {
        workerErrors.push(`[console.error] ${text}`)
      }
    }
  })

  page.on('pageerror', (err) => {
    const text = err.message
    if (workerPatterns.some((re) => re.test(text))) {
      workerErrors.push(`[pageerror] ${text}`)
    }
  })

  // Navigate via file:// directly — no HTTP server
  await page.goto(`file://${distHtml}`)

  // App should load: title and drop zone
  await expect(page).toHaveTitle(/pedift/i)
  await expect(page.locator('.dropzone').first()).toBeVisible({ timeout: 10_000 })

  // Check no worker errors just from loading
  expect(workerErrors, `Worker/blob errors on initial load: ${workerErrors.join(' | ')}`).toHaveLength(0)

  // Open a PDF — try filechooser first, fall back to programmatic DataTransfer drop
  let opened = false

  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5_000 }),
      page.locator('.dropzone').first().click(),
    ])
    await chooser.setFiles(path.join(FIXTURES, 'plain-3page.pdf'))
    opened = true
  } catch {
    // filechooser may not fire on file:// — fall back to drop event
  }

  if (!opened) {
    const fixtureBytes = Array.from(fs.readFileSync(path.join(FIXTURES, 'plain-3page.pdf')))

    await page.evaluate(async (bytes: number[]) => {
      const uint8 = new Uint8Array(bytes)
      const blob = new Blob([uint8], { type: 'application/pdf' })
      const file = new File([blob], 'plain-3page.pdf', { type: 'application/pdf' })

      const dt = new DataTransfer()
      dt.items.add(file)

      const dropzone = document.querySelector('.dropzone') as HTMLElement
      if (!dropzone) throw new Error('dropzone not found')

      dropzone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }))
      dropzone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }))
      dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
    }, fixtureBytes)
  }

  // Wait for canvas to render (proves the inlined worker executed successfully)
  const canvas = page.locator('.pagecanvas__canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThan(50)
  expect(box!.height).toBeGreaterThan(50)

  // CRITICAL: no worker-related console errors at any point during the test
  expect(workerErrors, `Worker/blob console errors detected: ${workerErrors.join(' | ')}`).toHaveLength(0)
})

// ─── f. Phase-2 smoke: rotate + save exercises @cantoo/pdf-lib in the browser ─

test('f. phase-2 rotate+save: pdf-lib runs in-browser, download is valid PDF', async ({ page }) => {
  await page.goto(APP)
  await openPdfViaChooser(page, path.join(FIXTURES, 'plain-3page.pdf'))
  await waitForCanvas(page)

  // Select the first page card (this reveals the rotate action buttons)
  await page.locator('.pagecard__btn').first().click()

  // Rotate right should now be visible
  await expect(page.getByRole('button', { name: /rotate right/i })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: /rotate right/i }).click()

  // Wait a tick for the edit to register
  await page.waitForTimeout(300)

  // Download the saved file
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /save/i }).click()
  const download = await downloadPromise

  const filePath = await download.path()
  expect(filePath).not.toBeNull()

  const data = fs.readFileSync(filePath!)
  expect(data.length).toBeGreaterThan(500)
  const header = data.slice(0, 5).toString('ascii')
  expect(header).toBe('%PDF-')
})
