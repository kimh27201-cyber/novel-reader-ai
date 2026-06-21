import assert from 'node:assert/strict'

const { friendlyErrorMessage } = await import('../common/uiFeedback.js')

assert.equal(
  friendlyErrorMessage({ message: 'request:fail' }),
  '后端连接失败，请确认 FastAPI 服务已启动'
)

assert.equal(
  friendlyErrorMessage({ errMsg: 'request:fail timeout' }),
  '后端连接超时，请确认 FastAPI 服务可访问，或稍后重试'
)

assert.equal(
  friendlyErrorMessage(new Error('就爱文学响应超时')),
  '目标站点响应超时，建议换源、稍后重试，或配置 Cookie/Header 后再测'
)

assert.equal(
  friendlyErrorMessage(new Error('Proxy request failed: timed out')),
  '后端代理访问目标站点超时，建议换源、稍后重试，或配置 Cookie/Header 后再测'
)

assert.equal(
  friendlyErrorMessage(new Error('请先登录后端')),
  '请先登录后端'
)

assert.equal(
  friendlyErrorMessage(null, '操作失败'),
  '操作失败'
)

console.log('uiFeedback tests passed')
