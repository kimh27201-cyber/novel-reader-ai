import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CODEX_PLAYWRIGHT_PATH || 'playwright')
const buildDir = resolve(process.env.THEME_UX_H5_BUILD_DIR || '.v3-build/h5-theme-ux')
const artifactDir = resolve(process.env.THEME_UX_ARTIFACT_DIR || 'output/theme-panel-ux')
const executablePath = process.env.CODEX_CHROMIUM_EXECUTABLE || ''
mkdirSync(artifactDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {})
})
const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
const pageErrors = []
page.on('pageerror', error => pageErrors.push(String(error)))

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

await page.route('http://theme-ux.local/**', async route => {
  const url = new URL(route.request().url())
  const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
  const filePath = resolve(buildDir, pathname)
  if (!filePath.startsWith(buildDir)) return route.abort('accessdenied')
  try {
    await route.fulfill({
      status: 200,
      contentType: mimeTypes[extname(filePath)] || 'application/octet-stream',
      body: readFileSync(filePath)
    })
  } catch (error) {
    await route.fulfill({ status: 404, body: 'Not found' })
  }
})

const readGeometry = () => page.evaluate(() => {
  const panel = document.querySelector('.theme-panel')
  const grid = document.querySelector('.theme-grid')
  const actions = document.querySelector('.theme-panel-actions')
  const tabbar = document.querySelector('.glass-tabbar')
  const box = element => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height }
  }
  return {
    viewportHeight: window.innerHeight,
    pageScrollY: window.scrollY,
    panel: box(panel),
    grid: box(grid),
    actions: box(actions),
    tabbar: tabbar ? box(tabbar) : null
  }
})

try {
  await page.goto('http://theme-ux.local/#/pages/profile/profile')
  await page.waitForLoadState('networkidle')
  await page.locator('.profile-page').waitFor({ state: 'visible' })
  await page.locator('.setting-item', { hasText: '主题设置' }).click()
  await page.locator('.theme-panel').waitFor({ state: 'visible' })
  await page.waitForTimeout(360)

  const initial = await readGeometry()
  await page.screenshot({ path: resolve(artifactDir, 'theme-panel-initial.png'), fullPage: true })

  const gridScroll = await page.locator('.theme-grid').evaluate(element => {
    const candidates = [...element.querySelectorAll('.uni-scroll-view')]
    const scroller = candidates.find(node => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) || candidates.at(-1) || element
    const before = scroller.scrollTop
    scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    return { before, after: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight }
  })
  await page.waitForTimeout(80)
  const afterGridScroll = await readGeometry()

  const startedAt = Date.now()
  await page.locator('.theme-card').nth(1).click()
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() === '#ff7a59')
  const tokenUpdateMs = Date.now() - startedAt
  const previewDuration = await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-theme-morph-duration'))

  await page.locator('.theme-card').nth(2).click()
  await page.waitForTimeout(18)
  await page.locator('.theme-card').nth(3).click()
  await page.waitForTimeout(18)
  await page.locator('.theme-card').nth(4).click()
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() === '#d5af62')
  const rapidSelection = await page.evaluate(() => ({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim(),
    activeCards: document.querySelectorAll('.theme-card.active').length,
    morphing: document.documentElement.classList.contains('app-theme-morphing')
  }))
  await page.screenshot({ path: resolve(artifactDir, 'theme-panel-switched.png'), fullPage: true })

  await page.waitForTimeout(360)
  const cleanedUp = await page.evaluate(() => !document.documentElement.classList.contains('app-theme-morphing'))
  await page.locator('.theme-apply-button').click()
  await page.locator('.theme-panel').waitFor({ state: 'hidden' })

  const actionsInitiallyVisible = initial.actions.bottom <= initial.viewportHeight
    && (!initial.tabbar || initial.actions.bottom <= initial.tabbar.top + 1)
  const panelStayedFixed = Math.abs(initial.panel.top - afterGridScroll.panel.top) <= 1
    && Math.abs(initial.actions.top - afterGridScroll.actions.top) <= 1
    && initial.pageScrollY === afterGridScroll.pageScrollY
  const result = {
    actionsInitiallyVisible,
    panelStayedFixed,
    gridScroll,
    tokenUpdateMs,
    previewDuration,
    rapidSelection,
    cleanedUp,
    pageErrors,
    passed: actionsInitiallyVisible
      && panelStayedFixed
      && gridScroll.after > gridScroll.before
      && tokenUpdateMs <= 140
      && previewDuration === '260ms'
      && rapidSelection.accent === '#d5af62'
      && rapidSelection.activeCards === 1
      && cleanedUp
      && pageErrors.length === 0
  }
  writeFileSync(resolve(artifactDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
} finally {
  await browser.close()
}
