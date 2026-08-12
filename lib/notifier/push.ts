import webpush from 'web-push'
import { prisma } from '../prisma'
import type { Notifier, NotificationPayload } from './types'

let configured = false

function configure() {
  if (configured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('VAPID 키가 없습니다. `npm run vapid`로 만들어 .env에 넣으세요.')
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    publicKey,
    privateKey,
  )
  configured = true
}

/// 브라우저 웹 푸시.
///
/// PWA가 스스로 정해진 시각에 깨어날 수단이 웹 표준에 없기 때문에,
/// 서버가 푸시를 보내 서비스 워커를 깨우는 이 경로가 알림의 유일한 수단이다.
export class PushNotifier implements Notifier {
  readonly channel = 'push'

  async send(payload: NotificationPayload): Promise<void> {
    configure()

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: payload.userId },
    })
    if (subs.length === 0) throw new Error('푸시 구독이 없습니다. 브라우저에서 알림을 허용했는지 확인하세요.')

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      badgeCount: payload.badgeCount,
      reminderId: payload.reminderId,
    })

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        ),
      ),
    )

    // 만료된 구독(404/410)은 정리한다. 안 그러면 매번 실패로 남는다.
    const dead: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const code = (r.reason as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) dead.push(subs[i].endpoint)
      }
    })
    if (dead.length) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } })
    }

    // 한 기기라도 성공했으면 발송으로 본다.
    if (!results.some((r) => r.status === 'fulfilled')) {
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(`모든 기기 발송 실패: ${first?.reason}`)
    }
  }
}
