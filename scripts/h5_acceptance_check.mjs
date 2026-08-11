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
  ruleSearch: { bookList: '$.items[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForHealth(timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/health')
      if (response.ok) return response.json()
    } catch {}
    await sleep(500)
  }
  throw new Error('FastAPI health check timed out')
}

async function clickByText(page, text) {
  const locator = page.getByText(text, { exact: true }).first()
  await locator.waitFor({ state: 'visible' })
  await locator.click({ force: true })
}

async function main() {
  await mkdir(artifactDir, { recursive: true })
  const backend = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8765'], {
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
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true })
    const page = await context.newPage()
    page.setDefaultTimeout(12000)

    await page.goto(`${baseUrl.replace(/#\/?$/, '#/')}pages/library/library`, { waitUntil: 'networkidle' })
    await clickByText(page, '扫码/链接添加书源')
    await page.locator('.method-card').filter({ hasText: '粘贴导入' }).first().click({ force: true })

    const textarea = page.locator('textarea.source-area, uni-textarea textarea, textarea').first()
    await textarea.waitFor({ state: 'visible' })
    await textarea.fill(JSON.stringify(sampleSource))
    await textarea.evaluate(element => {
      const host = element.closest('uni-textarea')
      if (host) {
        if (host.__vue__) host.__vue__.$emit('input', element.value)
      }
    })
    await page.screenshot({ path: `${artifactDir}\\01-import-filled.png`, fullPage: true })

    await clickByText(page, '导入前预览')
    const preview = page.locator('.preview-card').first()
    if (!await preview.isVisible().catch(() => false)) {
      await textarea.evaluate(async element => {
        let vm = element.closest('uni-textarea')?.__vue__
        while (vm && typeof vm.previewSourceImport !== 'function') vm = vm.$parent
        if (!vm) throw new Error('Library page component not found')
        await vm.previewSourceImport()
      })
    }
    await preview.waitFor({ state: 'visible' })
    await preview.getByText(/新增\s*1/).waitFor({ state: 'visible' })
    await page.screenshot({ path: `${artifactDir}\\02-preview.png`, fullPage: true })

    await textarea.evaluate(async element => {
      let vm = element.closest('uni-textarea')?.__vue__
      while (vm && typeof vm.submitSourceImport !== 'function') vm = vm.$parent
      if (!vm) throw new Error('Library page component not found')
      await vm.submitSourceImport()
    })
    await page.waitForTimeout(1200)
    await page.goto(`${baseUrl.replace(/#\/?$/, '#/')}pages/library/library`, { waitUntil: 'networkidle' })
    await page.waitForFunction(name => document.body.innerText.includes(name), sampleName)
    await page.waitForFunction(() => document.body.innerText.includes('最近导入') && document.body.innerText.includes('列表可见'))
    await page.screenshot({ path: `${artifactDir}\\03-imported.png`, fullPage: true })

    console.log(JSON.stringify({ ok: true, health, sampleName, artifacts: artifactDir }, null, 2))
  } finally {
    if (browser) await browser.close()
    if (!backend.killed) backend.kill()
  }
}

main().catch(error => {
  console.error(error && error.stack || error)
  process.exit(1)
})
