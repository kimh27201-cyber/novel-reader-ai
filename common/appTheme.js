const APP_THEME_KEY = 'app:theme'

export const appThemes = [
  {
    id: 'neon',
    name: '霓虹蓝紫',
    desc: '高对比赛博光感',
    vars: {
      '--app-bg': 'linear-gradient(130deg, rgba(57, 215, 255, 0.10) 0%, transparent 28%), linear-gradient(228deg, rgba(138, 92, 255, 0.16) 0%, transparent 34%), linear-gradient(180deg, #050712 0%, #090d1c 48%, #061119 100%)',
      '--app-accent': '#67fff2',
      '--app-accent-2': '#39d7ff',
      '--app-accent-3': '#9d6cff',
      '--app-text': '#f4f9ff',
      '--app-muted': '#8ba0c2',
      '--app-panel': 'rgba(15, 23, 44, 0.74)',
      '--app-panel-strong': 'rgba(16, 24, 45, 0.90)'
    }
  },
  {
    id: 'aurora',
    name: '冰青极光',
    desc: '清冷、通透、护眼',
    vars: {
      '--app-bg': 'linear-gradient(130deg, rgba(103, 255, 242, 0.12) 0%, transparent 32%), linear-gradient(220deg, rgba(65, 255, 180, 0.10) 0%, transparent 40%), linear-gradient(180deg, #031014 0%, #071b22 52%, #06131b 100%)',
      '--app-accent': '#8efff4',
      '--app-accent-2': '#49e5ff',
      '--app-accent-3': '#5dffb9',
      '--app-text': '#efffff',
      '--app-muted': '#91c8cc',
      '--app-panel': 'rgba(8, 35, 45, 0.76)',
      '--app-panel-strong': 'rgba(9, 45, 55, 0.90)'
    }
  },
  {
    id: 'luxury',
    name: '黑金轻奢',
    desc: '低调、高级、沉稳',
    vars: {
      '--app-bg': 'linear-gradient(132deg, rgba(255, 209, 112, 0.12), transparent 36%), linear-gradient(226deg, rgba(112, 77, 255, 0.12), transparent 42%), linear-gradient(180deg, #080706 0%, #15100d 52%, #090908 100%)',
      '--app-accent': '#ffd16f',
      '--app-accent-2': '#ff9f6f',
      '--app-accent-3': '#8f77ff',
      '--app-text': '#fff8ea',
      '--app-muted': '#b9a98f',
      '--app-panel': 'rgba(34, 25, 18, 0.76)',
      '--app-panel-strong': 'rgba(42, 29, 20, 0.90)'
    }
  },
  {
    id: 'midnight',
    name: '纯黑护眼',
    desc: '少光效、适合夜里',
    vars: {
      '--app-bg': 'linear-gradient(180deg, #02040a 0%, #060914 52%, #02040a 100%)',
      '--app-accent': '#b8c7ff',
      '--app-accent-2': '#7ea4ff',
      '--app-accent-3': '#67fff2',
      '--app-text': '#edf3ff',
      '--app-muted': '#8994aa',
      '--app-panel': 'rgba(14, 18, 30, 0.82)',
      '--app-panel-strong': 'rgba(18, 22, 36, 0.94)'
    }
  }
]

export function getAppThemeId() {
  const saved = uni.getStorageSync(APP_THEME_KEY)
  return appThemes.some(theme => theme.id === saved) ? saved : 'neon'
}

export function getAppTheme() {
  return appThemes.find(theme => theme.id === getAppThemeId()) || appThemes[0]
}

export function getAppThemeStyle(themeId = getAppThemeId()) {
  const theme = appThemes.find(item => item.id === themeId) || appThemes[0]
  return theme.vars
}

export function saveAppTheme(themeId) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : 'neon'
  uni.setStorageSync(APP_THEME_KEY, next)
  return next
}
