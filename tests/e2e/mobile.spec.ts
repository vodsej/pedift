import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Mobile-layout guards. The workspace used to be a shrunken desktop layout below
// ~720px: the topbar controls overlapped and the rightmost annotate tools were
// clipped off-screen (unreachable). On phones the Pages panel now collapses to an
// off-canvas drawer, the topbar trims to icon-only essentials, and the tool palette
// wraps instead of overflowing. These tests run at a phone viewport; the desktop
// layout is covered by smoke.spec.ts / toolbar-height.spec.ts (which run ≥1000px).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures')
const APP = '/pedift.html'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

async function openDoc(page: import('@playwright/test').Page) {
  await page.goto(APP)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.dropzone').first().click(),
  ])
  await chooser.setFiles(path.join(FIXTURES, 'plain-3page.pdf'))
  await expect(page.locator('.pagecanvas__canvas').first()).toBeVisible({ timeout: 30_000 })
}

const left = (page: import('@playwright/test').Page) =>
  page.evaluate(() => Math.round(document.querySelector('.sidebar')!.getBoundingClientRect().left))

test('mobile: pages sidebar is an off-canvas drawer toggled from the topbar', async ({ page }) => {
  await openDoc(page)

  // The mobile-only Pages toggle is shown; the sidebar starts off-screen (left < 0).
  await expect(page.locator('.topbar__pages-toggle')).toBeVisible()
  expect(await left(page)).toBeLessThan(0)
  await expect(page.locator('.sidebar-scrim')).toHaveCount(0)

  // Open → drawer slides in (left == 0) and a dimmer scrim appears.
  await page.locator('.topbar__pages-toggle').click()
  await expect(page.locator('.sidebar-scrim')).toBeVisible()
  await expect.poll(() => left(page)).toBe(0)

  // Tapping a page closes the drawer and switches the viewed page.
  await page.locator('.pagecard').nth(1).locator('.pagecard__btn').click()
  await expect.poll(() => left(page)).toBeLessThan(0)
  await expect(page.locator('.stage__statusbar')).toContainText('2 of 3')

  // Re-open, then dismiss by tapping the scrim.
  await page.locator('.topbar__pages-toggle').click()
  await expect.poll(() => left(page)).toBe(0)
  await page.locator('.sidebar-scrim').click({ position: { x: 360, y: 400 } })
  await expect.poll(() => left(page)).toBeLessThan(0)
})

test('mobile: annotate toolbar wraps (no horizontal overflow / clipped tools)', async ({ page }) => {
  await openDoc(page)
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('.annotate-toolbar')!
    return el.scrollWidth - el.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(0)
  // The last tool button (stamp) must be on-screen, not clipped past the viewport.
  const stamp = page.getByRole('button', { name: 'Stamp', exact: true })
  const box = await stamp.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
})

test('mobile: topbar trims to icon-only essentials without overlap', async ({ page }) => {
  await openDoc(page)
  const state = await page.evaluate(() => {
    const hidden = (sel: string) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el).display === 'none' : true
    }
    return {
      labelsHidden: Array.from(document.querySelectorAll('.topbar__btnlabel')).every(
        (e) => getComputedStyle(e).display === 'none',
      ),
      zoomHidden: hidden('.topbar__zoom'),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  expect(state.labelsHidden).toBe(true)
  expect(state.zoomHidden).toBe(true)
  expect(state.pageOverflow).toBeLessThanOrEqual(0)

  // Core actions still reachable: Document menu opens, Save is present.
  await page.getByRole('button', { name: 'Document', exact: true }).click()
  await expect(page.locator('.docmenu__list')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
})
