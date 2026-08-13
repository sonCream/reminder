/* 서비스 워커.
 *
 * PWA가 스스로 정해진 시각에 깨어날 방법이 웹 표준에 없기 때문에,
 * 서버가 보낸 푸시로 이 파일이 깨어나는 것이 알림의 유일한 경로다.
 * 앱이 완전히 닫혀 있어도 브라우저가 이 워커를 살려서 push 이벤트를 전달한다.
 */

self.addEventListener('install', () => {
  // 새 버전을 바로 적용한다. 개발 중 예전 워커가 남아 헷갈리는 일을 막는다.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: '리마인더', body: event.data ? event.data.text() : '' }
  }

  // 처리할 대상이 있을 때만 버튼을 단다.
  // 테스트 알림은 reminderId 가 없으므로 버튼 없이 뜬다 — 눌러도 아무 일이
  // 일어나지 않는 버튼을 보여주는 것보다 낫다.
  const actionable = typeof data.reminderId === 'number' && data.reminderId > 0

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || '리마인더', {
        body: data.body || '리마인더 시간입니다.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        // 회차마다 다른 값이어야 한다.
        //
        // 리마인더 id 로 묶으면 매일 오는 알림이 전부 같은 tag 가 되어,
        // 안드로이드가 이를 "기존 알림 교체"로 처리하면서 팝업(heads-up)을 생략한다.
        // 목록에는 들어오는데 화면 위로 뜨지 않는 원인이었다.
        //
        // 서버가 발송 건 id 를 tagKey 로 내려준다. 회차마다 다르고,
        // 같은 건을 재시도할 때는 같아서 중복은 여전히 걸러진다.
        tag: `reminder-${data.tagKey || data.reminderId || 'x'}`,
        renotify: true,
        // 사용자가 확인하기 전에 저절로 사라지지 않게 한다.
        // 리마인더는 놓치면 의미가 없다.
        //
        // 화면 위로 튀어나오는 팝업(heads-up) 여부는 여기서 정할 수 없다.
        // 안드로이드는 알림 채널의 중요도를 보고 OS 가 결정하며,
        // 그 값은 사용자가 시스템 설정에서만 바꿀 수 있다.
        requireInteraction: true,
        // 앱을 열지 않고 알림에서 바로 처리하는 버튼.
        // ⚠️ iOS 는 이 버튼을 표시하지 않는다. 그 경우 알림을 누르면 앱이 열리는
        //    기존 동작으로 자연스럽게 내려앉는다.
        actions: actionable
          ? [
              { action: 'done', title: '완료' },
              { action: 'snooze', title: `${data.snoozeMinutes || 15}분 뒤` },
            ]
          : [],
        data: {
          url: data.url || '/',
          reminderId: data.reminderId,
        },
      })

      // 앱 아이콘의 숫자 배지. iOS(16.4+)와 데스크톱 크롬/엣지에서만 동작하고,
      // 안드로이드 크롬에는 이 API가 없으므로 조용히 건너뛴다.
      if (typeof data.badgeCount === 'number' && self.navigator.setAppBadge) {
        if (data.badgeCount > 0) await self.navigator.setAppBadge(data.badgeCount)
        else await self.navigator.clearAppBadge()
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  const url = data.url || '/'
  const action = event.action

  event.notification.close()

  // 완료 / 나중에 — 앱을 열지 않고 서버에 바로 알린다.
  if (action === 'done' || action === 'snooze') {
    event.waitUntil(handleAction(action, data))
    return
  }

  // 알림 본문을 누른 경우 — 앱을 연다.
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // 이미 앱이 열려 있으면 새 창을 만들지 않고 그쪽으로 보낸다.
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})

async function handleAction(action, data) {
  if (typeof data.reminderId !== 'number' || data.reminderId <= 0) return

  try {
    const response = await fetch(`/api/reminders/${data.reminderId}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const body = await response.json()

    if (typeof body.badgeCount === 'number' && self.navigator.setAppBadge) {
      if (body.badgeCount > 0) await self.navigator.setAppBadge(body.badgeCount)
      else await self.navigator.clearAppBadge()
    }

    // 열려 있는 화면이 있으면 목록을 다시 불러오게 알린다.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) client.postMessage({ type: 'reminders-changed' })
  } catch (error) {
    // 오프라인이거나 서버가 죽었을 때. 조용히 삼키면 사용자는 처리된 줄 안다.
    await self.registration.showNotification('처리하지 못했습니다', {
      body: '네트워크를 확인한 뒤 앱에서 다시 시도해 주세요.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `reminder-error-${data.reminderId}`,
      data: { url: data.url || '/' },
    })
  }
}
