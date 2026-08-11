import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const playwrightPath = process.env.CODEX_PLAYWRIGHT_PATH || 'playwright'
const { chromium } = require(playwrightPath)
const chromiumExecutable = process.env.CODEX_CHROMIUM_EXECUTABLE || ''

const baseUrl = process.env.V3_H5_URL || 'http://v3.local/'
const themes = ['xuanye', 'candy', 'sakura', 'cyber', 'noirGold']
const viewportWidths = [375, 393, 412]
const scriptDir = dirname(fileURLToPath(import.meta.url))
const artifactDir = resolve(process.env.V3_ARTIFACT_DIR || resolve(scriptDir, '..', 'output', 'v3-acceptance'))
const buildDir = resolve(process.env.V3_H5_BUILD_DIR || resolve(scriptDir, '..', '.v3-build', 'h5'))

mkdirSync(artifactDir, { recursive: true })

async function waitForApp(page, selector) {
  await page.waitForLoadState('networkidle')
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 })
}

async function overflowMetrics(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyWidth: document.body ? document.body.scrollWidth : 0,
    rootWidth: document.documentElement.scrollWidth
  }))
}

const results = {
  screenshots: [],
  viewports: [],
  interactions: [],
  sharedTransitions: [],
  reducedMotionSharedSkipped: false,
  scrollParallax: null,
  layoutFlip: null,
  performanceProfiles: null,
  timeAwareness: null,
  pageErrors: []
}
const browser = await chromium.launch({
  headless: true,
  ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {})
})
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference'
})
await context.addInitScript(() => {
  const params = new URL(window.location.href).searchParams
  const cores = Number(params.get('__cores'))
  const memory = Number(params.get('__memory'))
  if (cores > 0) Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => cores })
  if (memory > 0) Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => memory })
})
const page = await context.newPage()
page.on('pageerror', error => results.pageErrors.push(String(error)))

if (baseUrl.startsWith('http://v3.local/')) {
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
  await page.route('http://v3.local/**', async route => {
    const url = new URL(route.request().url())
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
    const filePath = resolve(buildDir, pathname)
    if (!filePath.startsWith(buildDir)) {
      await route.abort('accessdenied')
      return
    }
    try {
      const extension = filePath.slice(filePath.lastIndexOf('.'))
      await route.fulfill({
        status: 200,
        contentType: mimeTypes[extension] || 'application/octet-stream',
        body: readFileSync(filePath)
      })
    } catch (error) {
      await route.fulfill({ status: 404, body: 'Not found' })
    }
  })
}

try {
  for (const [index, themeId] of themes.entries()) {
    await page.goto(`${baseUrl}#/pages/profile/profile`)
    await waitForApp(page, '.profile-page')
    await page.locator('.setting-item', { hasText: '主题设置' }).click()
    await page.locator('.theme-panel').waitFor({ state: 'visible' })
    await page.locator('.theme-card').nth(index).click()
    await page.waitForTimeout(650)

    const themePath = join(artifactDir, `${themeId}-theme.png`)
    await page.screenshot({ path: themePath, fullPage: true })
    results.screenshots.push(themePath)

    await page.locator('.theme-apply-button').click()
    await page.locator('.theme-panel').waitFor({ state: 'hidden' })
    await page.goto(`${baseUrl}#/pages/bookshelf/bookshelf`)
    await waitForApp(page, '.decoder-page')
    await page.waitForTimeout(450)

    const shelfPath = join(artifactDir, `${themeId}-bookshelf.png`)
    await page.screenshot({ path: shelfPath, fullPage: true })
    results.screenshots.push(shelfPath)

    const sourceCover = page.locator('.d-book-cover').first()
    const sharedCover = page.locator('.shared-book-transition')
    const sharedCoverAttached = sharedCover.waitFor({ state: 'attached', timeout: 5000 })
    // Pause only the test-page breathe loop so Playwright can perform a
    // standard pointer click on the real shared-transition origin.
    await page.addStyleTag({ content: '.d-book-cover.is-recent { animation: none !important; }' })
    const sourceCoverBox = await sourceCover.boundingBox()
    await sourceCover.click()
    try {
      await sharedCoverAttached
    } catch (error) {
      throw new Error(`Shared cover was not mounted after navigation: ${page.url()}`, { cause: error })
    }
    await page.locator('.reader-page').waitFor({ state: 'visible', timeout: 5000 })
    const sharedState = await sharedCover.evaluate(element => ({
      left: Number.parseFloat(element.style.left),
      top: Number.parseFloat(element.style.top),
      width: Number.parseFloat(element.style.width),
      height: Number.parseFloat(element.style.height),
      animationName: getComputedStyle(element).animationName,
      targetX: element.style.getPropertyValue('--shared-book-x'),
      targetY: element.style.getPropertyValue('--shared-book-y')
    }))
    results.sharedTransitions.push({
      themeId,
      source: sourceCoverBox,
      shared: sharedState,
      passed: Boolean(sourceCoverBox)
        && Math.abs(sharedState.left - sourceCoverBox.x) <= 1
        && Math.abs(sharedState.top - sourceCoverBox.y) <= 1
        && Math.abs(sharedState.width - sourceCoverBox.width) <= 1
        && Math.abs(sharedState.height - sourceCoverBox.height) <= 1
        && sharedState.animationName.includes('shared-book-flight')
        && Boolean(sharedState.targetX)
        && Boolean(sharedState.targetY)
    })
    await sharedCover.waitFor({ state: 'detached', timeout: 1600 })
    await page.locator('.reading-surface').click({ position: { x: 196, y: 420 } })
    await page.locator('.top-chrome.reader-chrome-visible').waitFor({ state: 'visible' })
    await page.waitForTimeout(260)
    const readerPath = join(artifactDir, `${themeId}-reader.png`)
    await page.screenshot({ path: readerPath, fullPage: true })
    results.screenshots.push(readerPath)
  }

  await page.goto(`${baseUrl}#/pages/reader/reader?bookId=wind-city`)
  await waitForApp(page, '.reader-page')
  await page.locator('.reading-surface').click({ position: { x: 196, y: 420 } })
  await page.locator('.dock-tool[aria-label="目录"]').click()
  await page.locator('.catalog-content').waitFor({ state: 'visible' })
  results.interactions.push('catalog-open')
  await page.locator('.catalog-content .close-button').click()
  await page.locator('.catalog-content').waitFor({ state: 'hidden' })
  results.interactions.push('catalog-close')
  await page.locator('.dock-tool[aria-label="界面设置"]').click()
  await page.locator('.settings-panel').waitFor({ state: 'visible' })
  results.interactions.push('settings-open')
  await page.locator('.settings-panel .close-button').click()
  await page.locator('.settings-panel').waitFor({ state: 'hidden' })
  results.interactions.push('settings-close')

  await page.goto(`${baseUrl}#/pages/profile/profile`)
  await waitForApp(page, '.profile-page')
  const readTimeAwarenessState = () => page.evaluate(() => ({
    enabled: document.documentElement.getAttribute('data-time-awareness'),
    slot: document.documentElement.getAttribute('data-time-slot'),
    ambient: document.documentElement.style.getPropertyValue('--app-time-ambient'),
    breatheOffset: document.documentElement.style.getPropertyValue('--app-time-breathe-offset')
  }))
  const initialTimeState = await readTimeAwarenessState()
  const timeAwarenessSetting = page.locator('.setting-item', { hasText: '时间氛围' })
  await timeAwarenessSetting.click()
  await page.waitForFunction(() => document.documentElement.getAttribute('data-time-awareness') === 'off')
  const disabledTimeState = await readTimeAwarenessState()
  await timeAwarenessSetting.click()
  await page.waitForFunction(() => document.documentElement.getAttribute('data-time-awareness') === 'on')
  const restoredTimeState = await readTimeAwarenessState()
  const validSlots = ['morning', 'day', 'evening', 'night']
  results.timeAwareness = {
    initial: initialTimeState,
    disabled: disabledTimeState,
    restored: restoredTimeState,
    passed: initialTimeState.enabled === 'on'
      && validSlots.includes(initialTimeState.slot)
      && Boolean(initialTimeState.ambient)
      && Boolean(initialTimeState.breatheOffset)
      && disabledTimeState.enabled === 'off'
      && disabledTimeState.slot === 'day'
      && restoredTimeState.enabled === 'on'
      && validSlots.includes(restoredTimeState.slot)
  }

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 852 })
    for (const [route, selector] of [
      ['pages/bookshelf/bookshelf', '.decoder-page'],
      ['pages/profile/profile', '.profile-page'],
      ['pages/reader/reader?bookId=wind-city', '.reader-page']
    ]) {
      await page.goto(`${baseUrl}#/${route}`)
      await waitForApp(page, selector)
      const metrics = await overflowMetrics(page)
      metrics.width = width
      metrics.route = route
      metrics.passed = metrics.bodyWidth <= metrics.innerWidth + 1 && metrics.rootWidth <= metrics.innerWidth + 1
      results.viewports.push(metrics)
    }
  }

  const toggleShelfLayout = async () => {
    await page.locator('.top-more-button').click()
    await page.locator('.menu-item', { hasText: '切换布局' }).click()
  }
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${baseUrl}#/pages/bookshelf/bookshelf`)
  await waitForApp(page, '.decoder-page')
  if (await page.locator('.book-list.compact').count()) {
    await toggleShelfLayout()
    await page.locator('.book-list.list').waitFor({ state: 'visible' })
    await page.waitForTimeout(340)
  }
  await toggleShelfLayout()
  await page.locator('.book-list.compact').waitFor({ state: 'visible' })
  const activeFlipAnimations = await page.locator('.shelf-swipe-row').evaluateAll(elements => elements.map(element => {
    const animations = element.getAnimations().filter(animation => animation.id.startsWith('layout-flip:'))
    return animations.map(animation => ({
      id: animation.id,
      duration: animation.effect && animation.effect.getTiming().duration,
      playState: animation.playState
    }))
  }))
  await page.waitForTimeout(340)
  const remainingFlipAnimations = await page.locator('.shelf-swipe-row').evaluateAll(elements => elements.reduce(
    (count, element) => count + element.getAnimations().filter(animation => animation.id.startsWith('layout-flip:')).length,
    0
  ))
  const normalFlipCount = activeFlipAnimations.flat().length
  results.layoutFlip = {
    normal: {
      animatedRows: normalFlipCount,
      animations: activeFlipAnimations,
      remainingAfterFinish: remainingFlipAnimations
    },
    reduced: null,
    passed: false
  }

  const dispatchShelfScroll = scrollTop => page.locator('.book-list').evaluate((element, value) => {
    const scrollCandidates = [...element.querySelectorAll('.uni-scroll-view')]
    const scroller = scrollCandidates.find(node => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) || scrollCandidates.at(-1) || element
    const content = element.querySelector('.uni-scroll-view-content') || scroller.firstElementChild
    if (content && scroller.scrollHeight <= scroller.clientHeight) {
      const spacer = document.createElement('div')
      spacer.setAttribute('data-v3-scroll-spacer', 'true')
      spacer.style.height = '900px'
      spacer.style.pointerEvents = 'none'
      content.appendChild(spacer)
    }
    scroller.scrollTop = value
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  }, scrollTop)
  const readShelfParallax = () => page.locator('.tab-page-shell').evaluate(element => {
    const style = getComputedStyle(element)
    return {
      ambientY: Number.parseFloat(style.getPropertyValue('--shelf-parallax-ambient-y')) || 0,
      horizonY: Number.parseFloat(style.getPropertyValue('--shelf-parallax-horizon-y')) || 0,
      markerY: Number.parseFloat(style.getPropertyValue('--shelf-parallax-marker-y')) || 0,
      opacity: Number.parseFloat(style.getPropertyValue('--shelf-depth-opacity')) || 0
    }
  })

  await page.goto(`${baseUrl}#/pages/bookshelf/bookshelf`)
  await waitForApp(page, '.decoder-page')
  const initialParallax = await readShelfParallax()
  await dispatchShelfScroll(120)
  await page.waitForTimeout(80)
  const movedParallax = await readShelfParallax()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${baseUrl}#/pages/bookshelf/bookshelf`)
  await waitForApp(page, '.decoder-page')
  await dispatchShelfScroll(120)
  await page.waitForTimeout(80)
  const reducedParallax = await readShelfParallax()
  results.scrollParallax = {
    initial: initialParallax,
    moved: movedParallax,
    reduced: reducedParallax,
    passed: initialParallax.ambientY === 0
      && initialParallax.horizonY === 0
      && initialParallax.markerY === 0
      && movedParallax.ambientY < 0
      && movedParallax.horizonY < movedParallax.ambientY
      && movedParallax.markerY > 0
      && movedParallax.opacity > initialParallax.opacity
      && reducedParallax.ambientY === 0
      && reducedParallax.horizonY === 0
      && reducedParallax.markerY === 0
  }
  const reducedLayoutBefore = await page.locator('.book-list.compact').count() ? 'compact' : 'list'
  await toggleShelfLayout()
  const reducedLayoutAfter = reducedLayoutBefore === 'compact' ? 'list' : 'compact'
  await page.locator(`.book-list.${reducedLayoutAfter}`).waitFor({ state: 'visible' })
  const reducedFlipCount = await page.locator('.shelf-swipe-row').evaluateAll(elements => elements.reduce(
    (count, element) => count + element.getAnimations().filter(animation => animation.id.startsWith('layout-flip:')).length,
    0
  ))
  results.layoutFlip.reduced = {
    from: reducedLayoutBefore,
    to: reducedLayoutAfter,
    animatedRows: reducedFlipCount
  }
  results.layoutFlip.passed = normalFlipCount === 2
    && activeFlipAnimations.flat().every(animation => Number(animation.duration) >= 220 && Number(animation.duration) <= 300)
    && remainingFlipAnimations === 0
    && reducedFlipCount === 0
  await page.locator('.book-info').first().click()
  await page.locator('.reader-page').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(120)
  results.reducedMotionSharedSkipped = await page.locator('.shared-book-transition').count() === 0
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const runPerformanceProfileCase = async ({ cores, memory }) => {
    await page.goto(`${baseUrl}?__cores=${cores}&__memory=${memory}#/pages/bookshelf/bookshelf`)
    await waitForApp(page, '.decoder-page')
    const tier = await page.evaluate(() => document.documentElement.getAttribute('data-app-performance'))
    const recentCoverCount = await page.locator('.d-book-cover.is-recent').count()
    const staggerRowCount = await page.locator('.shelf-swipe-row.shelf-enter').count()
    const initialDepth = await readShelfParallax()
    await dispatchShelfScroll(120)
    await page.waitForTimeout(80)
    const movedDepth = await readShelfParallax()
    const layoutBefore = await page.locator('.book-list.compact').count() ? 'compact' : 'list'
    await toggleShelfLayout()
    const layoutAfter = layoutBefore === 'compact' ? 'list' : 'compact'
    await page.locator(`.book-list.${layoutAfter}`).waitFor({ state: 'visible' })
    const animatedRows = await page.locator('.shelf-swipe-row').evaluateAll(elements => elements.reduce(
      (count, element) => count + element.getAnimations().filter(animation => animation.id.startsWith('layout-flip:')).length,
      0
    ))
    return { tier, recentCoverCount, staggerRowCount, initialDepth, movedDepth, animatedRows }
  }
  const liteProfile = await runPerformanceProfileCase({ cores: 2, memory: 2 })
  const balancedProfile = await runPerformanceProfileCase({ cores: 4, memory: 4 })
  const fullProfile = await runPerformanceProfileCase({ cores: 8, memory: 8 })
  results.performanceProfiles = {
    lite: liteProfile,
    balanced: balancedProfile,
    full: fullProfile,
    passed: liteProfile.tier === 'lite'
      && liteProfile.recentCoverCount === 0
      && liteProfile.staggerRowCount === 0
      && liteProfile.movedDepth.ambientY === 0
      && liteProfile.animatedRows === 0
      && balancedProfile.tier === 'balanced'
      && balancedProfile.recentCoverCount === 0
      && balancedProfile.staggerRowCount > 0
      && balancedProfile.movedDepth.ambientY === 0
      && balancedProfile.animatedRows > 0
      && fullProfile.tier === 'full'
      && fullProfile.recentCoverCount === 1
      && fullProfile.staggerRowCount > 0
      && fullProfile.movedDepth.ambientY < 0
      && fullProfile.animatedRows > 0
  }
} finally {
  await browser.close()
}

const failedViewports = results.viewports.filter(item => !item.passed)
results.passed = results.screenshots.length === 15
  && results.interactions.length === 4
  && results.sharedTransitions.length === 5
  && results.sharedTransitions.every(item => item.passed)
  && results.reducedMotionSharedSkipped
  && results.scrollParallax?.passed === true
  && results.layoutFlip?.passed === true
  && results.performanceProfiles?.passed === true
  && results.timeAwareness?.passed === true
  && failedViewports.length === 0
  && results.pageErrors.length === 0
console.log(JSON.stringify(results, null, 2))
if (!results.passed) process.exitCode = 1
