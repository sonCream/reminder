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

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || '리마인더', {
        body: data.body || '리마인더 시간입니다.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        // 같은 리마인더의 알림이 여러 개 쌓이지 않게 한다.
        tag: `reminder-${data.reminderId ?? 'x'}`,
        renotify: true,
        data: { url: data.url || '/' },
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
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

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
