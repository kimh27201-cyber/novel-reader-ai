import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const themeId = String(process.argv[2] || '').trim()
assert(themeId, 'usage: node scripts/cdp_voice_theme_preview.mjs <theme-id>')

const source = readFileSync(new URL('../common/appTheme.js', import.meta.url), 'utf8')
const arrayStart = source.indexOf('[', source.indexOf('const themeDefinitions'))
const arrayEndMarker = '\n]\n\nconst BASE_THEME_VARS'
const arrayEnd = source.indexOf(arrayEndMarker, arrayStart)
assert(arrayStart >= 0 && arrayEnd >= 0, 'unable to read app theme definitions')

const themes = vm.runInNewContext(`(${source.slice(arrayStart, arrayEnd + 2)})`)
const theme = themes.find(item => item.id === themeId)
assert(theme, `unknown theme: ${themeId}`)

const targets = await fetch('http://127.0.0.1:9223/json').then(response => response.json())
const target = targets.find(item => String(item.title || '').startsWith('pages/voice/voice'))
assert(target && target.webSocketDebuggerUrl, 'voice page CDP target is unavailable')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

const id = 1
const expression = `(() => {
  const root = document.querySelector('.voice-page')
  if (!root) return { applied: false }
  const vars = ${JSON.stringify(theme.vars)}
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
  return { applied: true, themeId: ${JSON.stringify(theme.id)}, themeName: ${JSON.stringify(theme.name)} }
})()`

socket.send(JSON.stringify({
  id,
  method: 'Runtime.evaluate',
  params: { expression, returnByValue: true }
}))

const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('CDP evaluation timed out')), 5000)
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id !== id) return
    clearTimeout(timeout)
    resolve(message)
  })
})
socket.close()

assert.equal(result.result?.result?.value?.applied, true, 'voice page root was not found')
console.log(JSON.stringify(result.result.result.value))
