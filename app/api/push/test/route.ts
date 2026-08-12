import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNotifier } from '@/lib/notifier'

export const dynamic = 'force-dynamic'

/// 설정 화면의 "테스트 알림 보내기". 스케줄러를 기다리지 않고 지금 바로 한 건 쏜다.
export async function POST() {
  const overdue = await prisma.reminder.count({
    where: { userId: 'local', doneAt: null, remindAt: { lte: new Date() } },
  })

  try {
    await getNotifier('push').send({
      userId: 'local',
      reminderId: 0,
      title: '테스트 알림',
      body: '이 알림이 보이면 푸시 연결이 정상입니다.',
      url: '/',
      badgeCount: overdue,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
