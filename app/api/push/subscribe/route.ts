import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/api'

export const dynamic = 'force-dynamic'

/// 브라우저가 만든 푸시 구독을 저장한다. 같은 기기가 다시 구독하면 갱신만 한다.
export async function POST(request: Request) {
  try {
    const user = await requireUser()
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
        userId: user.id,
        userAgent: request.headers.get('user-agent'),
      },
      // 같은 기기를 다른 사람이 쓰게 되면 주인도 함께 옮겨간다.
      // 그러지 않으면 이전 사용자에게 알림이 계속 간다.
      update: { p256dh, auth, userId: user.id, lastSeenAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

/// 알림 끄기.
export async function DELETE(request: Request) {
  try {
    const user = await requireUser()
    const endpoint = new URL(request.url).searchParams.get('endpoint')
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint가 필요합니다.' }, { status: 400 })
    }
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
