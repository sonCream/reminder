'use client'

/**
 * 안드로이드 크롬의 설치 프롬프트를 붙잡아 둔다.
 *
 * 크롬은 설치 조건을 만족하면 beforeinstallprompt 를 던지는데, 기본 동작을 막아두면
 * 원하는 시점에 다시 띄울 수 있다. 그래서 앱 안의 버튼 하나로 설치가 끝난다 —
 * "메뉴 → 앱 설치" 를 말로 설명할 필요가 없어진다.
 *
 * ⚠️ iOS 에는 이 이벤트가 없다. 애플이 제공하지 않아 그림으로 안내하는 수밖에 없다.
 *
 * 이벤트가 React 가 마운트되기 전에 올 수 있어서, 훅이 아니라 모듈 수준에서 받아둔다.
 */

type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: PromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as PromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function canInstall(): boolean {
  return deferred !== null
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  if (outcome === 'accepted') {
    deferred = null
    notify()
  }
  return outcome === 'accepted'
}
