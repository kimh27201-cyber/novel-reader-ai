import Vue from 'vue'
import App from './App'
import { notifyAppFirstPaint, primeAppTheme } from './common/appTheme.js'

Vue.config.productionTip = false
App.mpType = 'app'
const initialThemeId = primeAppTheme()

const app = new Vue({
  ...App
})

app.$mount()

Vue.nextTick(() => {
  const reveal = () => notifyAppFirstPaint(initialThemeId)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(reveal))
    return
  }
  setTimeout(reveal, 0)
})
