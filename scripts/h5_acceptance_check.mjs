import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'file:///D:/Cache/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs'
const { chromium } = await import(playwrightModule)

const root = 'D:\\Codex\\novel-reader-uniapp'
const backendDir = `${root}\\backend`
const python = `${backendDir}\\.venv\\Scripts\\python.exe`
const baseUrl = process.env.H5_URL || 'http://localhost:8080/#/'
const artifactDir = process.env.H5_ACCEPTANCE_ARTIFACTS || 'D:\\tmp\\UserTemp\\codex-h5-acceptance'

const sampleName = `Codex H5 验收书源 ${Date.now()}`
const sampleSource = {
  bookSourceName: sampleName,
  bookSourceUrl: 'https://h5-accept.example.com',
  bookSourceGroup: 'Codex验收',
  searchUrl: '/search?q={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url'
  },
  exploreUrl: '全部::/list?page={{page}}',
  ruleExplore: {
    bookList: '$.items[*]',
    name: '$.name',
    bookUrl: '$.url'
  },
  ruleBookInfo: {
    name: '$.name',
    author: '$.author'
  },
  ruleToc: {
    chapterList: '$.chapters[*]',
    chapterName: '$.title',
    chapterUrl: '$.url'
  },
  ruleContent: {
    content: '$.content'
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/health')
      if (response.ok) return await response.json()
    } catch {}
    await sleep(500)
  }
  throw new Error('FastAPI health check timed out')
}

async function clickByText(page, text) {
  const locator = page.getByText(text, { exact: true }).first()
  await locator.waitFor({ state: 'visible', timeout: 10000 })
  await locator.evaluate(element => {
    const clickable = element.closest('button,uni-button') || element
    clickable.click()
  })
}

async function clickCardByText(page, text) {
  const card = page.locator('.method-card').filter({ hasText: text }).first()
  await card.waitFor({ state: 'visible', timeout: 10000 })
  await card.click({ force: true })
}

async function main() {
  await mkdir(artifactDir, { recursive: true })
  const backend = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8765'], {
    cwd: backendDir,
    windowsHide: true,
    stdio: 'ignore'
  })

  let browser
  try {
    const health = await waitForHealth()
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--disable-gpu', '--disable-crash-reporter']
    })
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      isMobile: true
    })
    const page = await context.newPage()
    page.setDefaultTimeout(12000)

    await page.goto(`${baseUrl.replace(/#\/?$/, '#/') }pages/library/library`, { waitUntil: 'networkidle' })
    await page.getByText('扫码/链接添加书源', { exact: true }).waitFor({ state: 'visible' })
    await page.screenshot({ path: `${artifactDir}\\01-library.png`, fullPage: true })

    await clickByText(page, '扫码/链接添加书源')
    await clickCardByText(page, '粘贴导入')
    await page.screenshot({ path: `${artifactDir}\\02-before-fill.png`, fullPage: true })
    const textarea = page.locator('textarea.source-area, textarea, uni-textarea textarea').first()
    try {
      await textarea.waitFor({ state: 'visible', timeout: 5000 })
    } catch (error) {
      const debug = await page.evaluate(() => ({
        text: document.body.innerText,
        textareaCount: document.querySelectorAll('textarea').length,
        inputCount: document.querySelectorAll('input').length,
        sourceAreaCount: document.querySelectorAll('.source-area').length
      }))
      throw new Error(`Textarea not visible after selecting JSON mode: ${JSON.stringify(debug, null, 2)}`)
    }
    await textarea.fill(JSON.stringify(sampleSource))
    await page.screenshot({ path: `${artifactDir}\\02-import-drawer.png`, fullPage: true })

    await clickByText(page, '导入前预览')
    await page.getByText(/新增\s*1/).waitFor({ state: 'visible' })
    await page.locator('.preview-card .test-title').filter({ hasText: '导入前预览' }).waitFor({ state: 'visible' })
    await page.screenshot({ path: `${artifactDir}\\03-preview.png`, fullPage: true })

    await page.locator('.submit-button').filter({ hasText: '导入书源' }).first().click({ force: true })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${artifactDir}\\04-after-submit.png`, fullPage: true })
    const afterSubmit = await page.evaluate(() => {
      const storage = {}
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        storage[key] = localStorage.getItem(key)
      }
      return {
        url: location.href,
        text: document.body.innerText,
        keys: Object.keys(storage),
        storage
      }
    })
    await page.goto(`${baseUrl.replace(/#\/?$/, '#/') }pages/library/library`, { waitUntil: 'networkidle' })
    try {
      await page.waitForFunction(name => document.body.innerText.includes(name), sampleName, { timeout: 12000 })
    } catch (error) {
      const debug = await page.evaluate(({ name, afterSubmit }) => {
        const storage = {}
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index)
          if (/source|book/i.test(key || '')) storage[key] = localStorage.getItem(key)
        }
        return {
          name,
        text: document.body.innerText,
        afterSubmit,
        storage
      }
      }, { name: sampleName, afterSubmit })
      throw new Error(`Imported source is not visible: ${JSON.stringify(debug, null, 2).slice(0, 6000)}`)
    }
    await page.waitForFunction(() => document.body.innerText.includes('最近导入') && document.body.innerText.includes('列表可见'), null, { timeout: 12000 })
    await page.screenshot({ path: `${artifactDir}\\04-recent-import.png`, fullPage: true })

    console.log(JSON.stringify({
      ok: true,
      health,
      sampleName,
      artifacts: artifactDir
    }, null, 2))
  } finally {
    if (browser) await browser.close()
    if (!backend.killed) backend.kill()
  }
}

main().catch(error => {
  console.error(error && error.stack || error)
  process.exit(1)
})
