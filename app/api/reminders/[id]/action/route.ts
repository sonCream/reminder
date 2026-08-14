import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/api'
import { completeReminder, snoozeReminder } from '@/lib/reminders'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * 알림의 버튼(완료 / 나중에)이 호출하는 곳.
 *
 * 서비스 워커가 앱을 열지 않고 부르지만, 요청에 세션 쿠키가 함께 실린다.
 * 응답에 배지 숫자를 담아 워커가 곧바로 아이콘 배지를 갱신할 수 있게 한다.
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const id = Number((await params).id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const { action } = (await request.json()) as { action?: string }

    if (action === 'done') {
      await completeReminder(id, true, user.id)
    } else if (action === 'snooze') {
      await snoozeReminder(id, user.id)
    } else {
      return NextResponse.json({ error: '알 수 없는 동작입니다.' }, { status: 400 })
    }

    const badgeCount = await prisma.reminder.count({
      where: { userId: user.id, doneAt: null, remindAt: { lte: new Date() } },
    })

    return NextResponse.json({ ok: true, badgeCount })
  } catch (error) {
    return errorResponse(error)
  }
}
