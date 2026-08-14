import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/api'
import { getNotifier } from '@/lib/notifier'

export const dynamic = 'force-dynamic'

/// 설정 화면의 "테스트 알림 보내기". 스케줄러를 기다리지 않고 지금 바로 한 건 쏜다.
export async function POST() {
  try {
    const user = await requireUser()

    const overdue = await prisma.reminder.count({
      where: { userId: user.id, doneAt: null, remindAt: { lte: new Date() } },
    })

    await getNotifier('push').send({
      userId: user.id,
      // 0 이면 서비스 워커가 알림에 버튼을 달지 않는다. 테스트에는 처리할 대상이 없다.
      reminderId: 0,
      title: '테스트 알림',
      body: '이 알림이 보이면 푸시 연결이 정상입니다.',
      url: '/',
      badgeCount: overdue,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
