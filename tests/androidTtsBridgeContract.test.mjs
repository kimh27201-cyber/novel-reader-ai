import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mainActivity = readFileSync(
  new URL('../android-webview-shell/src/com/novelreader/v1/MainActivity.java', import.meta.url),
  'utf8'
)
const manifest = readFileSync(
  new URL('../android-webview-shell/AndroidManifest.xml', import.meta.url),
  'utf8'
)

assert.match(
  mainActivity,
  /addJavascriptInterface\(new TextToSpeechBridge\(\), "NovelReaderTts"\)/
)
assert.match(mainActivity, /new TextToSpeech\(getApplicationContext\(\)/)
assert.match(mainActivity, /textToSpeech\.setLanguage\(Locale\.SIMPLIFIED_CHINESE\)/)
assert.match(mainActivity, /new UtteranceProgressListener\(\)/)

assert.match(mainActivity, /@JavascriptInterface\s+public String getState\(\)/)
assert.match(mainActivity, /@JavascriptInterface\s+public String getVoices\(\)/)
assert.match(
  mainActivity,
  /@JavascriptInterface\s+public boolean setVoice\(String voiceId\)/
)
assert.match(
  mainActivity,
  /@JavascriptInterface\s+public boolean speak\(\s*String text,\s*float rate,\s*String utteranceId,\s*String callbackName\)/
)
assert.match(mainActivity, /@JavascriptInterface\s+public boolean stop\(\)/)

assert.match(mainActivity, /payload\.put\("utteranceId", utteranceId/)
assert.match(mainActivity, /payload\.put\("status", status\)/)
assert.match(mainActivity, /payload\.put\("message", message/)
assert.match(mainActivity, /textToSpeech\.getVoices\(\)/)
assert.match(mainActivity, /textToSpeech\.setVoice\(/)
assert.match(mainActivity, /voice\.isNetworkConnectionRequired\(\)/)
assert.match(mainActivity, /"zh"\.equalsIgnoreCase\(language\)/)
assert.match(mainActivity, /item\.put\("provider", "system"\)/)
assert.match(mainActivity, /dispatchTtsResult\(utteranceId, "done", ""\)/)
assert.match(mainActivity, /dispatchTtsResult\(\s*utteranceId,\s*"error"/)

assert.match(
  mainActivity,
  /protected void onDestroy\(\)[\s\S]*textToSpeech\.stop\(\)[\s\S]*textToSpeech\.shutdown\(\)/
)
assert.match(manifest, /<queries>[\s\S]*android\.intent\.action\.TTS_SERVICE[\s\S]*<\/queries>/)

console.log('androidTtsBridgeContract tests passed')
