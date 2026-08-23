let activeLockCount = 0
let previousBodyOverflow = ''

function getBody() {
  try {
    return typeof document !== 'undefined' ? document.body : null
  } catch (error) {
    return null
  }
}

export function acquireOverlayScrollLock() {
  const body = getBody()
  if (!body) return false
  if (activeLockCount === 0) previousBodyOverflow = body.style.overflow || ''
  activeLockCount += 1
  body.style.overflow = 'hidden'
  return true
}

export function releaseOverlayScrollLock() {
  if (activeLockCount <= 0) return false
  activeLockCount -= 1
  if (activeLockCount === 0) {
    const body = getBody()
    if (body) body.style.overflow = previousBodyOverflow
    previousBodyOverflow = ''
  }
  return true
}

export function getOverlayScrollLockCount() {
  return activeLockCount
}

