const APP_THEME_KEY = 'app:theme'
const DEFAULT_THEME_ID = 'xuanye'

let themeMorphToken = 0
let themeMorphCleanupTimer = null
let themeMorphPulse = 0
let activeThemeViewTransition = null

const themeDefinitions = [
  {
    id: 'xuanye',
    name: '玄夜',
    desc: '高级、暗黑、神秘，适合默认展示和夜间解码',
    swatch: ['#080b10', '#67fff2', '#d8a75f'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 14% -8%, rgba(103, 255, 242, 0.14), transparent 30%), radial-gradient(circle at 86% 8%, rgba(143, 109, 255, 0.14), transparent 28%), linear-gradient(180deg, #080b10 0%, #0d111a 48%, #121017 100%)',
      '--app-top': 'linear-gradient(180deg, rgba(18, 24, 34, 0.98) 0%, rgba(10, 14, 22, 0.96) 100%)',
      '--app-accent': '#67fff2',
      '--app-accent-2': '#8f6dff',
      '--app-accent-3': '#d8a75f',
      '--app-on-accent': '#071014',
      '--app-text': '#f4f1e8',
      '--app-muted': '#8f9bad',
      '--app-panel': 'rgba(17, 22, 32, 0.74)',
      '--app-panel-strong': 'rgba(20, 25, 36, 0.92)',
      '--app-input': 'rgba(255, 255, 255, 0.07)',
      '--app-border': 'rgba(153, 231, 255, 0.14)',
      '--app-shadow': '0 18rpx 52rpx rgba(0, 0, 0, 0.34), inset 0 1rpx 0 rgba(255, 255, 255, 0.04)',
      '--app-stage': '#070a0f',
      '--app-shell-border': 'rgba(153, 231, 255, 0.18)',
      '--app-shell-shadow': '0 30rpx 96rpx rgba(0, 0, 0, 0.48)',
      '--app-floating-shadow': '0 -22rpx 76rpx rgba(0, 0, 0, 0.44)',
      '--app-reader-control': 'rgba(12, 17, 25, 0.94)',
      '--app-reader-control-text': '#f4f1e8',
      '--app-tabbar-icon-filter': 'none',
      '--app-tabbar-icon-opacity': '0.78',
      '--app-display-font': '"DIN Alternate", "PingFang SC", "Microsoft YaHei", sans-serif',
      '--app-utility-font': '"Cascadia Mono", "Consolas", monospace',
      '--app-heading-tracking': '1rpx',
      '--app-card-radius': '16rpx',
      '--app-control-radius': '12rpx',
      '--app-cover-radius': '10rpx',
      '--app-card-outline': 'inset 0 1rpx 0 rgba(103, 255, 242, 0.10)',
      '--app-motion-ease': 'cubic-bezier(0.18, 0.78, 0.24, 1)',
      '--app-reader-texture': 'linear-gradient(90deg, rgba(103, 255, 242, 0.035) 1rpx, transparent 1rpx) 0 0 / 32rpx 32rpx',
      '--app-voice-stage-decoration': 'repeating-linear-gradient(0deg, transparent, transparent 3rpx, rgba(103, 255, 242, 0.04) 3rpx, rgba(103, 255, 242, 0.04) 4rpx)',
      '--app-voice-stage-glow': 'rgba(103, 255, 242, 0.12)',
      '--app-voice-card-shape': 'var(--app-card-radius)',
      '--app-voice-card-outline': 'none',
      '--app-voice-selected-style': 'cursor',
      '--app-voice-label-font': 'var(--app-display-font)',
      '--app-voice-preview-ease': 'cubic-bezier(0.2, 0.9, 0.3, 1.1)',
      '--app-voice-card-stagger': '45ms'
    }
  },
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
  },
  {
    id: 'candy',
    name: '糖果绘本',
    desc: '明快、圆润、有贴纸感，适合轻松阅读与年轻表达',
    swatch: ['#fff7d6', '#ff7a59', '#55c7e8', '#ffd34e'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 20rpx 20rpx, rgba(85, 199, 232, 0.14) 0 4rpx, transparent 5rpx) 0 0 / 76rpx 76rpx, linear-gradient(160deg, #fff7d6 0%, #fffdf2 50%, #eafaff 100%)',
      '--app-top': 'linear-gradient(135deg, #fff0a8 0%, #ffd7c8 52%, #cceffc 100%)',
      '--app-accent': '#ff7a59',
      '--app-accent-2': '#55c7e8',
      '--app-accent-3': '#e9ad00',
      '--app-on-accent': '#321b14',
      '--app-text': '#342a32',
      '--app-muted': '#766a72',
      '--app-panel': 'rgba(255, 255, 255, 0.82)',
      '--app-panel-strong': 'rgba(255, 255, 255, 0.95)',
      '--app-input': 'rgba(255, 255, 255, 0.92)',
      '--app-border': 'rgba(255, 122, 89, 0.24)',
      '--app-shadow': '0 14rpx 0 rgba(85, 199, 232, 0.12), 0 24rpx 48rpx rgba(98, 76, 88, 0.10)',
      '--app-stage': '#fff7d6',
      '--app-shell-border': 'rgba(255, 122, 89, 0.30)',
      '--app-shell-shadow': '0 28rpx 86rpx rgba(98, 76, 88, 0.18)',
      '--app-floating-shadow': '0 -18rpx 58rpx rgba(98, 76, 88, 0.18)',
      '--app-reader-control': 'rgba(255, 255, 255, 0.96)',
      '--app-reader-control-text': '#342a32',
      '--app-tabbar-icon-filter': 'brightness(0) saturate(100%)',
      '--app-tabbar-icon-opacity': '0.52',
      '--app-card-radius': '26rpx',
      '--app-control-radius': '18rpx',
      '--app-pattern': 'radial-gradient(circle, rgba(85, 199, 232, 0.24) 0 3rpx, transparent 4rpx)',
      '--app-glow': '0 0 0 6rpx rgba(255, 211, 78, 0.22)',
      '--app-display-font': '"Arial Rounded MT Bold", "PingFang SC", "Microsoft YaHei", sans-serif',
      '--app-heading-tracking': '0.5rpx',
      '--app-card-border-width': '2rpx',
      '--app-cover-radius': '20rpx',
      '--app-card-outline': '4rpx 5rpx 0 rgba(255, 122, 89, 0.18)',
      '--app-motion-ease': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      '--app-motif-opacity': '0.32',
      '--app-reader-texture': 'radial-gradient(circle at 18rpx 18rpx, rgba(85, 199, 232, 0.12) 0 2rpx, transparent 3rpx) 0 0 / 44rpx 44rpx',
      '--app-voice-stage-decoration': 'radial-gradient(circle at 30% 30%, rgba(255, 211, 78, 0.18) 0 6rpx, transparent 7rpx), radial-gradient(circle at 80% 70%, rgba(85, 199, 232, 0.16) 0 5rpx, transparent 6rpx), radial-gradient(circle at 15% 85%, rgba(255, 122, 89, 0.14) 0 4rpx, transparent 5rpx)',
      '--app-voice-stage-glow': 'rgba(255, 122, 89, 0.16)',
      '--app-voice-card-shape': '32% 68% 56% 44% / 38% 42% 58% 62%',
      '--app-voice-card-outline': '3rpx 4rpx 0 rgba(255, 122, 89, 0.22)',
      '--app-voice-selected-style': 'sticker',
      '--app-voice-label-font': 'var(--app-display-font)',
      '--app-voice-preview-ease': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      '--app-voice-card-stagger': '65ms'
    }
  },
  {
    id: 'sakura',
    name: '樱雾少女',
    desc: '雾粉、丝带高光与精致细边框，柔美但保持清晰',
    swatch: ['#fff6fa', '#e97aae', '#a58be7', '#f4b9cb'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 12% 0%, rgba(244, 185, 203, 0.48), transparent 32%), radial-gradient(circle at 92% 16%, rgba(165, 139, 231, 0.22), transparent 30%), linear-gradient(180deg, #fff6fa 0%, #fffafd 52%, #f6f1ff 100%)',
      '--app-top': 'linear-gradient(135deg, #f8cddd 0%, #f3d9ef 48%, #dcd2fa 100%)',
      '--app-accent': '#d9609a',
      '--app-accent-2': '#8e73d8',
      '--app-accent-3': '#bd537f',
      '--app-on-accent': '#ffffff',
      '--app-text': '#493847',
      '--app-muted': '#826f80',
      '--app-panel': 'rgba(255, 255, 255, 0.76)',
      '--app-panel-strong': 'rgba(255, 255, 255, 0.93)',
      '--app-input': 'rgba(255, 255, 255, 0.88)',
      '--app-border': 'rgba(194, 94, 140, 0.20)',
      '--app-shadow': '0 18rpx 48rpx rgba(151, 91, 126, 0.12), inset 0 1rpx 0 rgba(255, 255, 255, 0.72)',
      '--app-stage': '#f8eff6',
      '--app-shell-border': 'rgba(194, 94, 140, 0.24)',
      '--app-shell-shadow': '0 30rpx 90rpx rgba(126, 80, 111, 0.20)',
      '--app-floating-shadow': '0 -20rpx 68rpx rgba(126, 80, 111, 0.18)',
      '--app-reader-control': 'rgba(255, 250, 253, 0.96)',
      '--app-reader-control-text': '#493847',
      '--app-tabbar-icon-filter': 'brightness(0) saturate(100%)',
      '--app-tabbar-icon-opacity': '0.50',
      '--app-card-radius': '24rpx',
      '--app-control-radius': '999rpx',
      '--app-pattern': 'linear-gradient(120deg, transparent 0 44%, rgba(255, 255, 255, 0.66) 45% 52%, transparent 53% 100%)',
      '--app-glow': '0 0 34rpx rgba(233, 122, 174, 0.24)',
      '--app-display-font': '"STKaiti", "KaiTi", "PingFang SC", serif',
      '--app-utility-font': '"PingFang SC", "Microsoft YaHei", sans-serif',
      '--app-heading-tracking': '0.8rpx',
      '--app-card-border-width': '1rpx',
      '--app-cover-radius': '18rpx',
      '--app-card-outline': 'inset 0 1rpx 0 rgba(255, 255, 255, 0.78)',
      '--app-motion-ease': 'cubic-bezier(0.22, 0.76, 0.32, 1)',
      '--app-motif-opacity': '0.28',
      '--app-reader-texture': 'linear-gradient(135deg, rgba(233, 122, 174, 0.04), transparent 36%), linear-gradient(45deg, transparent 0 49%, rgba(165, 139, 231, 0.05) 50% 51%, transparent 52%)',
      '--app-voice-stage-decoration': 'radial-gradient(ellipse at 25% 30%, rgba(233, 122, 174, 0.14), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(165, 139, 231, 0.10), transparent 50%)',
      '--app-voice-stage-glow': 'rgba(233, 122, 174, 0.18)',
      '--app-voice-card-shape': '26rpx',
      '--app-voice-card-outline': 'inset 0 1rpx 0 rgba(255, 255, 255, 0.72)',
      '--app-voice-selected-style': 'petal',
      '--app-voice-label-font': '"Noto Serif SC", "STSong", "SimSun", "PingFang SC", serif',
      '--app-voice-preview-ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
      '--app-voice-card-stagger': '55ms'
    }
  },
  {
    id: 'cyber',
    name: '量子蓝图',
    desc: '冷光网格、数据标签和解码线路，适合科技感界面',
    swatch: ['#050b18', '#34d6ff', '#6d7cff', '#a7ff5e'],
    vars: {
      '--app-bg': 'linear-gradient(rgba(52, 214, 255, 0.055) 1rpx, transparent 1rpx) 0 0 / 44rpx 44rpx, linear-gradient(90deg, rgba(52, 214, 255, 0.055) 1rpx, transparent 1rpx) 0 0 / 44rpx 44rpx, radial-gradient(circle at 74% 0%, rgba(109, 124, 255, 0.24), transparent 34%), linear-gradient(180deg, #050b18 0%, #081126 56%, #050914 100%)',
      '--app-top': 'linear-gradient(180deg, rgba(9, 23, 48, 0.98) 0%, rgba(5, 13, 29, 0.98) 100%)',
      '--app-accent': '#34d6ff',
      '--app-accent-2': '#6d7cff',
      '--app-accent-3': '#a7ff5e',
      '--app-on-accent': '#031019',
      '--app-text': '#e8f7ff',
      '--app-muted': '#91a8bd',
      '--app-panel': 'rgba(8, 22, 45, 0.78)',
      '--app-panel-strong': 'rgba(10, 25, 51, 0.94)',
      '--app-input': 'rgba(52, 214, 255, 0.07)',
      '--app-border': 'rgba(52, 214, 255, 0.24)',
      '--app-shadow': '0 0 0 1rpx rgba(52, 214, 255, 0.06), 0 18rpx 52rpx rgba(0, 0, 0, 0.38)',
      '--app-stage': '#030817',
      '--app-shell-border': 'rgba(52, 214, 255, 0.30)',
      '--app-shell-shadow': '0 32rpx 100rpx rgba(0, 0, 0, 0.54)',
      '--app-floating-shadow': '0 -22rpx 78rpx rgba(0, 0, 0, 0.50)',
      '--app-reader-control': 'rgba(5, 16, 35, 0.96)',
      '--app-reader-control-text': '#e8f7ff',
      '--app-tabbar-icon-filter': 'none',
      '--app-tabbar-icon-opacity': '0.78',
      '--app-card-radius': '8rpx',
      '--app-control-radius': '6rpx',
      '--app-pattern': 'linear-gradient(90deg, transparent 0 48%, rgba(52, 214, 255, 0.24) 49% 51%, transparent 52% 100%)',
      '--app-glow': '0 0 32rpx rgba(52, 214, 255, 0.28)',
      '--app-display-font': '"Cascadia Mono", "Consolas", "PingFang SC", monospace',
      '--app-utility-font': '"Cascadia Mono", "Consolas", monospace',
      '--app-heading-tracking': '1.4rpx',
      '--app-card-border-width': '1rpx',
      '--app-cover-radius': '4rpx',
      '--app-card-outline': '0 0 0 1rpx rgba(52, 214, 255, 0.10)',
      '--app-motion-ease': 'cubic-bezier(0.16, 0.84, 0.28, 1)',
      '--app-motif-opacity': '0.30',
      '--app-reader-texture': 'linear-gradient(rgba(52, 214, 255, 0.035) 1rpx, transparent 1rpx) 0 0 / 32rpx 32rpx, linear-gradient(90deg, rgba(52, 214, 255, 0.035) 1rpx, transparent 1rpx) 0 0 / 32rpx 32rpx',
      '--app-voice-stage-decoration': 'linear-gradient(rgba(52, 214, 255, 0.06) 1rpx, transparent 1rpx) 0 0 / 28rpx 28rpx, linear-gradient(90deg, rgba(52, 214, 255, 0.06) 1rpx, transparent 1rpx) 0 0 / 28rpx 28rpx',
      '--app-voice-stage-glow': 'rgba(52, 214, 255, 0.14)',
      '--app-voice-card-shape': '4rpx',
      '--app-voice-card-outline': 'none',
      '--app-voice-selected-style': 'bracket',
      '--app-voice-label-font': 'var(--app-utility-font)',
      '--app-voice-preview-ease': 'linear',
      '--app-voice-card-stagger': '30ms'
    }
  },
  {
    id: 'noirGold',
    name: '黑曜金',
    desc: '黑曜石底色与藏书票金线，克制、沉稳、有收藏感',
    swatch: ['#090806', '#18130d', '#d5af62', '#f2e2b5'],
    vars: {
      '--app-bg': 'radial-gradient(circle at 50% -12%, rgba(213, 175, 98, 0.15), transparent 34%), linear-gradient(135deg, rgba(213, 175, 98, 0.035) 25%, transparent 25%) 0 0 / 42rpx 42rpx, linear-gradient(180deg, #090806 0%, #110e0a 56%, #080705 100%)',
      '--app-top': 'linear-gradient(180deg, #1a150e 0%, #0d0b08 100%)',
      '--app-accent': '#d5af62',
      '--app-accent-2': '#8c6a32',
      '--app-accent-3': '#f2e2b5',
      '--app-on-accent': '#1b1408',
      '--app-text': '#f4ebd8',
      '--app-muted': '#aa9b80',
      '--app-panel': 'rgba(24, 19, 13, 0.78)',
      '--app-panel-strong': 'rgba(27, 22, 15, 0.95)',
      '--app-input': 'rgba(213, 175, 98, 0.07)',
      '--app-border': 'rgba(213, 175, 98, 0.25)',
      '--app-shadow': '0 20rpx 54rpx rgba(0, 0, 0, 0.46), inset 0 1rpx 0 rgba(242, 226, 181, 0.05)',
      '--app-stage': '#080705',
      '--app-shell-border': 'rgba(213, 175, 98, 0.34)',
      '--app-shell-shadow': '0 34rpx 104rpx rgba(0, 0, 0, 0.58)',
      '--app-floating-shadow': '0 -24rpx 82rpx rgba(0, 0, 0, 0.54)',
      '--app-reader-control': 'rgba(18, 14, 9, 0.97)',
      '--app-reader-control-text': '#f4ebd8',
      '--app-tabbar-icon-filter': 'none',
      '--app-tabbar-icon-opacity': '0.78',
      '--app-card-radius': '10rpx',
      '--app-control-radius': '8rpx',
      '--app-pattern': 'linear-gradient(90deg, transparent 0 8%, rgba(213, 175, 98, 0.24) 8% 9%, transparent 9% 91%, rgba(213, 175, 98, 0.24) 91% 92%, transparent 92% 100%)',
      '--app-glow': '0 0 28rpx rgba(213, 175, 98, 0.20)',
      '--app-display-font': '"Songti SC", "STSong", SimSun, "PingFang SC", serif',
      '--app-utility-font': '"Palatino Linotype", "Songti SC", SimSun, serif',
      '--app-heading-tracking': '1.2rpx',
      '--app-card-border-width': '1rpx',
      '--app-cover-radius': '6rpx',
      '--app-card-outline': 'inset 0 0 0 1rpx rgba(242, 226, 181, 0.08)',
      '--app-motion-ease': 'cubic-bezier(0.26, 0.68, 0.34, 1)',
      '--app-motif-opacity': '0.24',
      '--app-reader-texture': 'linear-gradient(90deg, rgba(213, 175, 98, 0.025) 1rpx, transparent 1rpx) 0 0 / 52rpx 52rpx',
      '--app-voice-stage-decoration': 'radial-gradient(circle at 50% 50%, rgba(213, 175, 98, 0.05) 0 1rpx, transparent 2rpx) 0 0 / 16rpx 16rpx',
      '--app-voice-stage-glow': 'rgba(213, 175, 98, 0.12)',
      '--app-voice-card-shape': '10rpx',
      '--app-voice-card-outline': 'inset 0 0 0 1rpx rgba(242, 226, 181, 0.10)',
      '--app-voice-selected-style': 'diamond',
      '--app-voice-label-font': '"Noto Serif SC", "STSong", "SimSun", "PingFang SC", serif',
      '--app-voice-preview-ease': 'cubic-bezier(0.6, 0, 0.4, 1)',
      '--app-voice-card-stagger': '55ms'
    }
  }
]

const BASE_THEME_VARS = {
  '--app-surface': 'rgba(255, 255, 255, 0.08)',
  '--app-card-radius': '18rpx',
  '--app-control-radius': '14rpx',
  '--app-cover-radius': '12rpx',
  '--app-pattern': 'none',
  '--app-glow': 'none',
  '--app-display-font': '"PingFang SC", "Microsoft YaHei", sans-serif',
  '--app-body-font': '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  '--app-utility-font': '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  '--app-heading-tracking': '0',
  '--app-card-border-width': '1rpx',
  '--app-card-outline': 'none',
  '--app-motion-ease': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  '--app-motif-opacity': '0.22',
  '--app-reader-texture': 'none',
  '--app-tabbar-icon-filter': 'none',
  '--app-tabbar-icon-opacity': '0.78',
  '--app-heading-font': '"PingFang SC", "Microsoft YaHei", sans-serif',
  '--app-motion-fast': '120ms',
  '--app-motion-instant': '80ms',
  '--app-space-xs': '8rpx',
  '--app-space-sm': '16rpx',
  '--app-space-md': '24rpx',
  '--app-space-lg': '32rpx',
  '--app-space-xl': '48rpx',
  '--app-font-size-xs': '20rpx',
  '--app-font-size-sm': '24rpx',
  '--app-font-size-md': '28rpx',
  '--app-font-size-lg': '36rpx',
  '--app-font-size-xl': '44rpx',
  '--app-font-size-xxl': '56rpx',
  '--app-motion-duration-fast': '120ms',
  '--app-motion-duration-normal': '240ms',
  '--app-motion-duration-slow': '380ms',
  '--app-motion-duration-exit': '180ms',
  '--app-motion-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  '--app-motion-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  '--app-motion-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
  '--app-motion-linear': 'cubic-bezier(0, 0, 1, 1)',
  '--app-z-base': '0',
  '--app-z-dropdown': '100',
  '--app-z-sticky': '200',
  '--app-z-overlay': '300',
  '--app-z-modal': '400',
  '--app-z-toast': '500',
  '--app-touch-target-min': '88rpx',
  '--app-touch-feedback-scale': '0.97',
  '--app-touch-feedback-duration': '80ms'
}

const ACTIVE_THEME_IDS = new Set(['xuanye', 'candy', 'sakura', 'cyber', 'noirGold'])

const THEME_META = {
  xuanye: {
    category: '品牌默认',
    preview: { kicker: '夜航解码', sample: '玄夜档案', motif: '星轨微光' },
    chrome: { color: '#8f9bad', selectedColor: '#d8a75f', backgroundColor: '#111620', borderStyle: 'black' }
  },
  qinglan: {
    category: '清新自然',
    preview: { kicker: '晨间书架', sample: '清岚手记', motif: '山岚留白' },
    chrome: { color: '#70847e', selectedColor: '#e26a4f', backgroundColor: '#eef7f5', borderStyle: 'white' }
  },
  paper: {
    category: '舒适阅读',
    preview: { kicker: '纸页时光', sample: '暖纸藏书', motif: '纸纤暖影' },
    chrome: { color: '#82705c', selectedColor: '#6f967b', backgroundColor: '#f7eddb', borderStyle: 'white' }
  },
  mint: {
    category: '轻快工具',
    preview: { kicker: '轻量整理', sample: '薄荷书单', motif: '空气感' },
    chrome: { color: '#6d8790', selectedColor: '#61b7d4', backgroundColor: '#eef8f3', borderStyle: 'white' }
  },
  night: {
    category: '夜间护眼',
    preview: { kicker: '深夜阅读', sample: '夜读模式', motif: '低亮柔光' },
    chrome: { color: '#b3bebc', selectedColor: '#e25f35', backgroundColor: '#2b2c2b', borderStyle: 'black' }
  },
  candy: {
    category: '卡通活力',
    preview: { kicker: '今日冒险', sample: '糖果绘本', motif: '书签贴纸' },
    chrome: { color: '#766a72', selectedColor: '#ff7a59', backgroundColor: '#fff9e5', borderStyle: 'white' }
  },
  sakura: {
    category: '少女柔雾',
    preview: { kicker: '樱色书房', sample: '樱雾心事', motif: '丝带高光' },
    chrome: { color: '#826f80', selectedColor: '#d9609a', backgroundColor: '#fff6fa', borderStyle: 'white' }
  },
  cyber: {
    category: '未来科技',
    preview: { kicker: 'DATA / SHELF', sample: '量子蓝图', motif: '解码网格' },
    chrome: { color: '#91a8bd', selectedColor: '#34d6ff', backgroundColor: '#071027', borderStyle: 'black' }
  },
  noirGold: {
    category: '暗金收藏',
    preview: { kicker: 'PRIVATE LIBRARY', sample: '黑曜藏书', motif: '藏书票金线' },
    chrome: { color: '#aa9b80', selectedColor: '#d5af62', backgroundColor: '#100d09', borderStyle: 'black' }
  }
}

export const appThemes = themeDefinitions.filter(theme => ACTIVE_THEME_IDS.has(theme.id)).map(theme => {
  const meta = THEME_META[theme.id] || {}
  return {
    ...theme,
    ...meta,
    vars: {
      ...BASE_THEME_VARS,
      '--app-surface': theme.vars['--app-panel-strong'] || theme.vars['--app-panel'],
      ...theme.vars
    }
  }
})

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

function resolveRuntimeRpx(value) {
  if (typeof value !== 'string' || !value.includes('rpx')) return value

  return value.replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, amount) => {
    const numericAmount = Number(amount)
    let pixels = numericAmount / 2

    try {
      if (typeof uni !== 'undefined' && typeof uni.upx2px === 'function') {
        pixels = uni.upx2px(numericAmount)
      } else if (typeof window !== 'undefined' && Number(window.innerWidth) > 0) {
        pixels = numericAmount * Number(window.innerWidth) / 750
      }
    } catch (error) {
      pixels = numericAmount / 2
    }

    const rounded = Math.round(pixels * 1000) / 1000
    return `${rounded}px`
  })
}

export function getAppThemeRuntimeStyle(themeId = getAppThemeId()) {
  const vars = getAppThemeStyle(themeId)
  return Object.keys(vars).reduce((resolved, key) => {
    resolved[key] = resolveRuntimeRpx(vars[key])
    return resolved
  }, {})
}

export function getAppThemeChrome(themeId = getAppThemeId()) {
  const theme = appThemes.find(item => item.id === themeId) || appThemes[0]
  return theme.chrome
}

function getNativeLaunchBridge() {
  try {
    return typeof globalThis !== 'undefined' && globalThis.NovelReaderLaunch
      ? globalThis.NovelReaderLaunch
      : null
  } catch (error) {
    return null
  }
}

export function syncAppThemeToNative(themeId = getAppThemeId()) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  try {
    const bridge = getNativeLaunchBridge()
    if (!bridge || typeof bridge.saveTheme !== 'function') return false
    bridge.saveTheme(next)
    return true
  } catch (error) {
    return false
  }
}

export function primeAppTheme(themeId = getAppThemeId()) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  applyAppThemeDocumentStyle(next)
  syncAppThemeToNative(next)
  return next
}

export function notifyAppFirstPaint(themeId = getAppThemeId()) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  try {
    const bridge = getNativeLaunchBridge()
    if (!bridge || typeof bridge.ready !== 'function') return false
    bridge.ready(next)
    return true
  } catch (error) {
    return false
  }
}

export function applyAppThemeDocumentStyle(themeId = getAppThemeId()) {
  const vars = getAppThemeStyle(themeId)
  try {
    if (typeof document === 'undefined' || !document.documentElement) return false
    Object.keys(vars).forEach(key => document.documentElement.style.setProperty(key, vars[key]))
    return true
  } catch (error) {
    return false
  }
}

export function applyAppThemeChrome(themeId = getAppThemeId()) {
  const chrome = getAppThemeChrome(themeId)
  applyAppThemeDocumentStyle(themeId)
  syncAppThemeToNative(themeId)
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit('app:theme-changed', themeId)
    }
  } catch (error) {
    // Theme chrome remains usable when the runtime does not expose the event bus.
  }
  try {
    if (typeof uni !== 'undefined' && typeof uni.setTabBarStyle === 'function') {
      uni.setTabBarStyle(chrome)
      return true
    }
  } catch (error) {
    return false
  }
  return false
}

export function previewAppTheme(themeId) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit('app:theme-preview', next)
    }
  } catch (error) {
    // Preview is optional and must never block selecting a theme card.
  }
  return next
}

export function saveAppTheme(themeId) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  uni.setStorageSync(APP_THEME_KEY, next)
  syncAppThemeToNative(next)
  return next
}

function isThemeMorphReduced() {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.getAttribute('data-app-motion') === 'reduced'
    }
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  } catch (error) {
    return false
  }
}

function isThemeMorphLite() {
  try {
    return typeof document !== 'undefined' && document.documentElement
      ? document.documentElement.getAttribute('data-app-performance') === 'lite'
      : false
  } catch (error) {
    return false
  }
}

function clearThemeMorphTimer() {
  if (themeMorphCleanupTimer) {
    clearTimeout(themeMorphCleanupTimer)
    themeMorphCleanupTimer = null
  }
}

function clearThemeMorphDocumentState() {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return
    const root = document.documentElement
    root.classList.remove('app-theme-morphing')
    root.classList.remove('app-theme-morph-fallback-a')
    root.classList.remove('app-theme-morph-fallback-b')
    root.style.removeProperty('--app-theme-morph-duration')
  } catch (error) {}
}

function emitThemeMorphEvent(name, payload) {
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit(name, payload)
    }
  } catch (error) {}
}

function commitTheme(next, options, token) {
  if (token !== themeMorphToken) return Promise.resolve()

  let commitResult
  try {
    if (typeof options.commit === 'function') commitResult = options.commit(next)
  } catch (error) {
    commitResult = Promise.reject(error)
  }

  if (options.persist === true) {
    applyAppThemeChrome(next)
  } else {
    applyAppThemeDocumentStyle(next)
    emitThemeMorphEvent('app:theme-preview', next)
  }

  return Promise.resolve(commitResult).catch(() => undefined)
}

function finishThemeMorph(token, payload) {
  if (token !== themeMorphToken) return
  clearThemeMorphTimer()
  activeThemeViewTransition = null
  clearThemeMorphDocumentState()
  emitThemeMorphEvent('app:theme-morph-complete', payload)
}

export function cancelAppThemeMorph() {
  themeMorphToken += 1
  clearThemeMorphTimer()
  if (activeThemeViewTransition && typeof activeThemeViewTransition.skipTransition === 'function') {
    try {
      activeThemeViewTransition.skipTransition()
    } catch (error) {}
  }
  activeThemeViewTransition = null
  clearThemeMorphDocumentState()
  return themeMorphToken
}

export function morphAppTheme(themeId, options = {}) {
  const next = appThemes.some(theme => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
  const persist = options.persist === true
  const preview = options.preview === true || (!persist && options.preview !== false)
  const animate = options.animate !== false
  const reduced = options.reduced === true || isThemeMorphReduced()
  const lite = isThemeMorphLite()
  const supportsViewTransition = !reduced && !lite && typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function'
  const engine = reduced || lite ? 'reduced' : (supportsViewTransition ? 'view-transition' : 'fallback')
  const defaultDuration = engine === 'view-transition' ? 220 : (engine === 'fallback' ? 120 : 80)
  const minDuration = engine === 'view-transition' ? 180 : (engine === 'fallback' ? 80 : 1)
  const maxDuration = engine === 'view-transition' ? 240 : (engine === 'fallback' ? 120 : 80)
  const duration = Math.max(minDuration, Math.min(maxDuration, Number(options.duration) || defaultDuration))
  const token = cancelAppThemeMorph() + 1
  themeMorphToken = token

  if (persist) {
    try {
      uni.setStorageSync(APP_THEME_KEY, next)
    } catch (error) {}
  }

  const payload = { themeId: next, duration: animate ? duration : 0, persist, preview, engine }

  if (!animate) {
    commitTheme(next, { ...options, persist }, token)
    return next
  }

  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const root = document.documentElement
      root.style.setProperty('--app-theme-morph-duration', `${duration}ms`)
      root.classList.add('app-theme-morphing')
    }
  } catch (error) {}

  if (supportsViewTransition) {
    try {
      const transition = document.startViewTransition(() => commitTheme(next, { ...options, persist }, token))
      activeThemeViewTransition = transition
      emitThemeMorphEvent('app:theme-morph-start', payload)
      if (transition && transition.ready && typeof transition.ready.catch === 'function') {
        transition.ready.catch(() => undefined)
      }
      const finished = transition && transition.finished
        ? Promise.resolve(transition.finished).catch(() => undefined)
        : Promise.resolve()
      themeMorphCleanupTimer = setTimeout(() => finishThemeMorph(token, payload), duration + 160)
      finished.then(() => finishThemeMorph(token, payload))
      return next
    } catch (error) {
      activeThemeViewTransition = null
      payload.engine = 'fallback'
      payload.duration = Math.min(120, duration)
    }
  }

  const fallbackClass = themeMorphPulse % 2 === 0
    ? 'app-theme-morph-fallback-a'
    : 'app-theme-morph-fallback-b'
  const previousFallbackClass = fallbackClass === 'app-theme-morph-fallback-a'
    ? 'app-theme-morph-fallback-b'
    : 'app-theme-morph-fallback-a'
  themeMorphPulse += 1
  try {
    document.documentElement.style.setProperty('--app-theme-morph-duration', `${payload.duration}ms`)
  } catch (error) {}
  emitThemeMorphEvent('app:theme-morph-start', payload)
  commitTheme(next, { ...options, persist }, token).then(() => {
    if (token !== themeMorphToken) return
    try {
      const root = document.documentElement
      root.classList.remove(previousFallbackClass)
      root.classList.add(fallbackClass)
    } catch (error) {}
    themeMorphCleanupTimer = setTimeout(() => finishThemeMorph(token, payload), payload.duration + 16)
  })

  return next
}
