const endpoint = process.argv[2] || 'http://127.0.0.1:9223'
const mode = process.argv[3] || 'retry'
const requestedTitle = process.argv[4] || ''
const requestedText = process.argv[5] || ''
const targets = await fetch(`${endpoint}/json/list`).then(response => response.json())
const target = mode === 'report'
  ? targets.find(item => String(item.title || '') === 'View')
  : ['click', 'inspect-reader', 'dom'].includes(mode)
    ? targets.find(item => String(item.title || '').includes(requestedTitle))
    : targets.find(item => String(item.title || '').includes('ttsAcceptance'))

if (!target || !target.webSocketDebuggerUrl) {
  throw new Error('未找到 TTS 自动验收 WebView')
}

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

const expression = mode === 'dom'
  ? `document.body ? document.body.innerText : ''`
  : mode === 'inspect-reader'
  ? `(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const page = pages.find(item => String(item.route || '').includes('pages/reader/reader'))
      const vm = page && page.$vm
      if (!vm) return null
      const chapter = vm.chapter || null
      const book = vm.book || null
      return {
        route: page.route,
        bookId: vm.bookId,
        chapterIndex: vm.chapterIndex,
        pageIndex: vm.pageIndex,
        source: book && book.source,
        sourceId: book && book.sourceId,
        backendId: book && book.backendId,
        chapter: chapter && {
          id: chapter.id,
          backendId: chapter.backendId,
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          url: chapter.url,
          contentLength: String(chapter.content || '').length,
          isCached: chapter.isCached
        }
      }
    })()`
  : mode === 'report'
  ? `({
      keys: Object.keys(localStorage),
      value: localStorage.getItem('ttsAcceptance:lastReport'),
      pages: typeof getCurrentPages === 'function'
        ? getCurrentPages().map(page => ({
            route: page.route,
            report: page.$vm && page.$vm.report
          }))
        : []
    })`
  : mode === 'click'
    ? `(() => {
        const expected = ${JSON.stringify(requestedText)}
        const elements = Array.from(document.querySelectorAll('*'))
        const matches = elements.filter(element => (element.textContent || '').trim() === expected)
        const target = matches.at(-1)
        if (!target) return { clicked: false }
        target.click()
        return { clicked: true, label: (target.textContent || '').trim() }
      })()`
    : `(() => {
      const elements = Array.from(document.querySelectorAll('*'))
      const matches = elements.filter(element => (element.textContent || '').trim() === '仅重试后台停止')
      const target = matches.at(-1)
      if (!target) return { clicked: false }
      target.click()
      return { clicked: true, label: (target.textContent || '').trim() }
    })()`

const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP 调用超时')), 5000)
  socket.addEventListener('message', event => {
    const payload = JSON.parse(String(event.data || '{}'))
    if (payload.id !== 1) return
    clearTimeout(timer)
    resolve(payload)
  })
  socket.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression,
      returnByValue: true
    }
  }))
})

socket.close()
const value = result && result.result && result.result.result
  ? result.result.result.value
  : null
console.log(JSON.stringify(value))
if (['retry', 'click'].includes(mode) && (!value || value.clicked !== true)) process.exitCode = 1
