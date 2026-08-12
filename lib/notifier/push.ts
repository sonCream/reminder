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

    // 기기별 결과를 반드시 남긴다.
    // 한 대라도 성공하면 '발송됨'으로 처리하기 때문에, 여기서 찍지 않으면
    // "아이폰은 오는데 안드로이드만 안 온다" 같은 상황이 로그에 흔적조차 남지 않는다.
    const dead: string[] = []
    results.forEach((r, i) => {
      const host = hostOf(subs[i].endpoint)
      if (r.status === 'fulfilled') {
        console.log(`[push] 성공 ${host}`)
        return
      }
      const reason = r.reason as { statusCode?: number; body?: string } | undefined
      console.error(`[push] 실패 ${host} status=${reason?.statusCode ?? '?'} ${reason?.body ?? r.reason}`)
      // 만료된 구독(404/410)은 정리한다. 안 그러면 매번 실패로 남는다.
      if (reason?.statusCode === 404 || reason?.statusCode === 410) dead.push(subs[i].endpoint)
    })

    if (dead.length) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } })
      console.warn(`[push] 만료된 구독 ${dead.length}건 삭제`)
    }

    // 한 기기라도 성공했으면 발송으로 본다.
    if (!results.some((r) => r.status === 'fulfilled')) {
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      throw new Error(`모든 기기 발송 실패: ${first?.reason}`)
    }
  }
}

/// 로그에 어느 기기인지 드러나게 한다. apple 이면 iPhone, fcm 이면 안드로이드다.
function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return '알 수 없음'
  }
}
