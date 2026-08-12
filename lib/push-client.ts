'use client'

/**
 * 브라우저 쪽 푸시 구독 처리.
 *
 * 알림이 안 오는 원인은 대부분 이 파일이 반환하는 실패 사유 중 하나다.
 * 그래서 실패를 조용히 삼키지 않고, 화면에 그대로 보여줄 문장으로 돌려준다.
 */

export type PushResult = { ok: true } | { ok: false; reason: string }

/// VAPID 공개키는 base64url 문자열인데, 브라우저는 바이트 배열을 요구한다.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function enablePush(): Promise<PushResult> {
  if (!('serviceWorker' in navigator)) {
    // HTTPS가 아니면 서비스 워커 자체가 등록되지 않는다. 폰 테스트에서 가장 흔한 원인.
    return {
      ok: false,
      reason: window.isSecureContext
        ? '이 브라우저는 서비스 워커를 지원하지 않습니다.'
        : 'HTTPS에서만 알림을 켤 수 있습니다. localhost 또는 https 주소로 접속해 주세요.',
    }
  }
  if (!('PushManager' in window)) {
    return { ok: false, reason: '이 브라우저는 웹 푸시를 지원하지 않습니다.' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      ok: false,
      reason:
        permission === 'denied'
          ? '알림이 차단돼 있습니다. 브라우저 주소창의 자물쇠 아이콘에서 알림을 허용해 주세요.'
          : '알림 권한이 필요합니다.',
    }
  }

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return { ok: false, reason: 'VAPID 공개키가 설정되지 않았습니다. .env를 확인해 주세요.' }

  const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      // 푸시를 받으면 반드시 눈에 보이는 알림을 띄우겠다는 약속. 브라우저가 요구한다.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    })
  }

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) return { ok: false, reason: '구독 정보를 서버에 저장하지 못했습니다.' }

  return { ok: true }
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
    method: 'DELETE',
  })
  await subscription.unsubscribe()
}
