import assert from 'node:assert/strict'

const { friendlyErrorMessage } = await import('../common/uiFeedback.js')

assert.equal(
  friendlyErrorMessage({ message: 'request:fail' }),
  '后端连接失败，请确认 FastAPI 服务已启动'
)

assert.equal(
  friendlyErrorMessage({ errMsg: 'request:fail timeout' }),
  '后端连接超时，请稍后重试'
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
