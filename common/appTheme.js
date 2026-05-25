const APP_THEME_KEY = 'app:theme'
const DEFAULT_THEME_ID = 'night'

export const appThemes = [
  {
    id: 'qinglan',
    name: '清岚',
    desc: '清新、通透、适合默认展示',
    swatch: ['#f4fbf8', '#70ad9f', '#e26a4f'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 12% 0%, rgba(143, 205, 191, 0.35), transparent 32%), linear-gradient(180deg, #f4fbf8 0%, #eef7f5 46%, #f8f3ea 100%)',
      '--app-top': 'linear-gradient(180deg, #b7dcd4 0%, #9ccdc3 100%)',
      '--app-accent': '#70ad9f',
      '--app-accent-2': '#8fc9bd',
      '--app-accent-3': '#e26a4f',
      '--app-on-accent': '#ffffff',
      '--app-text': '#20352f',
      '--app-muted': '#70847e',
      '--app-panel': 'rgba(255, 255, 255, 0.78)',
      '--app-panel-strong': 'rgba(255, 255, 255, 0.90)',
      '--app-input': 'rgba(255, 255, 255, 0.86)',
      '--app-border': 'rgba(76, 129, 117, 0.14)',
      '--app-shadow': '0 16rpx 38rpx rgba(64, 96, 89, 0.09)',
      '--app-stage': '#e4efeb',
      '--app-shell-border': 'rgba(73, 114, 105, 0.24)',
      '--app-shell-shadow': '0 28rpx 90rpx rgba(51, 83, 76, 0.22)',
      '--app-floating-shadow': '0 -20rpx 70rpx rgba(51, 83, 76, 0.20)',
      '--app-reader-control': 'rgba(255, 255, 255, 0.94)',
      '--app-reader-control-text': '#20352f'
    }
  },
  {
    id: 'paper',
    name: '暖纸',
    desc: '柔和、纸感、适合长时间阅读',
    swatch: ['#fff8ec', '#d79c5f', '#6f967b'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 14% 0%, rgba(235, 199, 140, 0.30), transparent 30%), linear-gradient(180deg, #fff8ec 0%, #f7eddb 52%, #edf4e7 100%)',
      '--app-top': 'linear-gradient(180deg, #ecd0a3 0%, #dfbd85 100%)',
      '--app-accent': '#d79c5f',
      '--app-accent-2': '#e8bb79',
      '--app-accent-3': '#6f967b',
      '--app-on-accent': '#ffffff',
      '--app-text': '#3f3326',
      '--app-muted': '#82705c',
      '--app-panel': 'rgba(255, 253, 247, 0.80)',
      '--app-panel-strong': 'rgba(255, 253, 247, 0.93)',
      '--app-input': 'rgba(255, 253, 247, 0.90)',
      '--app-border': 'rgba(157, 116, 61, 0.16)',
      '--app-shadow': '0 16rpx 38rpx rgba(133, 96, 49, 0.10)',
      '--app-stage': '#f0e7d6',
      '--app-shell-border': 'rgba(155, 114, 61, 0.24)',
      '--app-shell-shadow': '0 28rpx 90rpx rgba(119, 82, 38, 0.20)',
      '--app-floating-shadow': '0 -20rpx 70rpx rgba(119, 82, 38, 0.18)',
      '--app-reader-control': 'rgba(255, 253, 247, 0.95)',
      '--app-reader-control-text': '#3f3326'
    }
  },
  {
    id: 'mint',
    name: '薄荷',
    desc: '明亮、轻快、偏工具感',
    swatch: ['#f1fbff', '#61b7d4', '#8bbf77'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 16% 0%, rgba(117, 205, 226, 0.30), transparent 32%), linear-gradient(180deg, #f1fbff 0%, #eef8f3 50%, #f9fbef 100%)',
      '--app-top': 'linear-gradient(180deg, #b9e4ee 0%, #98d5e2 100%)',
      '--app-accent': '#61b7d4',
      '--app-accent-2': '#91d4e5',
      '--app-accent-3': '#8bbf77',
      '--app-on-accent': '#ffffff',
      '--app-text': '#203842',
      '--app-muted': '#6d8790',
      '--app-panel': 'rgba(255, 255, 255, 0.80)',
      '--app-panel-strong': 'rgba(255, 255, 255, 0.93)',
      '--app-input': 'rgba(255, 255, 255, 0.90)',
      '--app-border': 'rgba(80, 150, 171, 0.14)',
      '--app-shadow': '0 16rpx 38rpx rgba(59, 114, 128, 0.09)',
      '--app-stage': '#e2f1f4',
      '--app-shell-border': 'rgba(69, 136, 153, 0.22)',
      '--app-shell-shadow': '0 28rpx 90rpx rgba(50, 107, 121, 0.20)',
      '--app-floating-shadow': '0 -20rpx 70rpx rgba(50, 107, 121, 0.18)',
      '--app-reader-control': 'rgba(255, 255, 255, 0.95)',
      '--app-reader-control-text': '#203842'
    }
  },
  {
    id: 'night',
    name: '夜读',
    desc: '低亮、护眼、适合夜间',
    swatch: ['#151b20', '#8fc9bd', '#f0b46d'],
    vars: {
      '--app-bg': '#202124',
      '--app-top': '#60747d',
      '--app-accent': '#8fc9bd',
      '--app-accent-2': '#70ad9f',
      '--app-accent-3': '#e25f35',
      '--app-on-accent': '#0f1a18',
      '--app-text': '#f3f6f5',
      '--app-muted': '#b3bebc',
      '--app-panel': 'rgba(44, 45, 44, 0.92)',
      '--app-panel-strong': 'rgba(48, 50, 50, 0.96)',
      '--app-input': 'rgba(255, 255, 255, 0.08)',
      '--app-border': 'rgba(255, 255, 255, 0.08)',
      '--app-shadow': '0 14rpx 32rpx rgba(0, 0, 0, 0.26)',
      '--app-stage': '#202124',
      '--app-shell-border': 'rgba(255, 255, 255, 0.12)',
      '--app-shell-shadow': '0 28rpx 90rpx rgba(0, 0, 0, 0.34)',
      '--app-floating-shadow': '0 -20rpx 70rpx rgba(0, 0, 0, 0.32)',
      '--app-reader-control': 'rgba(34, 48, 50, 0.95)',
      '--app-reader-control-text': '#f4fbf8'
    }
  }
]

function getStorageThemeId() {
  try {
    return uni.getStorageSync(APP_THEME_KEY)
  } catch (error) {
    return ''
  }
}

export function getAppThemeId() {
  const saved = getStorageThemeId()
  return appThemes.some(theme => theme.id === saved) ? saved : DEFAULT_THEME_ID
}

export function getAppTheme() {
  return appThemes.find(theme => theme.id === getAppThemeId()) || appThemes[0]
}

export function getAppThemeStyle(themeId = getAppThemeId()) {
  const theme = appThemes.find(item => item.id === themeId) || appThemes[0]
  return theme.vars
}

export function saveAppTheme(themeId) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  uni.setStorageSync(APP_THEME_KEY, next)
  return next
}
