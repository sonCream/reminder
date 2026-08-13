import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { completeReminder, snoozeReminder } from '@/lib/reminders'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * 알림의 버튼(완료 / 나중에)이 호출하는 곳.
 *
 * 서비스 워커가 앱을 열지 않고 부르기 때문에, 화면 상태에 기대지 않고
 * 이것만으로 처리가 끝나야 한다. 응답에 배지 숫자를 실어 보내서
 * 워커가 곧바로 아이콘 배지를 갱신할 수 있게 한다.
 */
export async function POST(request: Request, { params }: Ctx) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { action } = (await request.json()) as { action?: string }

  try {
    if (action === 'done') {
      await completeReminder(id, true)
    } else if (action === 'snooze') {
      await snoozeReminder(id)
    } else {
      return NextResponse.json({ error: '알 수 없는 동작입니다.' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 404 })
  }

  const badgeCount = await prisma.reminder.count({
    where: { userId: 'local', doneAt: null, remindAt: { lte: new Date() } },
  })

  return NextResponse.json({ ok: true, badgeCount })
}
