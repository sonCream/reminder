import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/// 브라우저가 만든 푸시 구독을 저장한다. 같은 기기가 다시 구독하면 갱신만 한다.
export async function POST(request: Request) {
  const body = await request.json()
  const endpoint: unknown = body?.endpoint
  const p256dh: unknown = body?.keys?.p256dh
  const auth: unknown = body?.keys?.auth

  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: '구독 정보가 올바르지 않습니다.' }, { status: 400 })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get('user-agent'),
    },
    update: { p256dh, auth, lastSeenAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

/// 알림 끄기.
export async function DELETE(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint')
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint가 필요합니다.' }, { status: 400 })
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
}
