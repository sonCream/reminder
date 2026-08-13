import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  completeReminder,
  deleteReminder,
  rescheduleReminder,
  scheduleNotifications,
} from '@/lib/reminders'
import { toDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const body = await request.json()
  const current = await prisma.reminder.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: '리마인더를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 1) 완료 토글
  if (typeof body.done === 'boolean') {
    return NextResponse.json({ reminder: toDTO(await completeReminder(id, body.done)) })
  }

  // 2) 목록에서 누르는 "+5분" 같은 시간 밀기.
  //    새 시각 계산을 서버에서 하므로 여러 기기에서 동시에 눌러도 결과가 어긋나지 않는다.
  if (typeof body.shiftMinutes === 'number') {
    const next = new Date(current.remindAt.getTime() + body.shiftMinutes * 60_000)
    return NextResponse.json({ reminder: toDTO(await rescheduleReminder(id, next)) })
  }

  // 3) 편집 화면 저장
  const remindAt = body.remindAt ? new Date(body.remindAt) : null
  if (remindAt && Number.isNaN(remindAt.getTime())) {
    return NextResponse.json({ error: '알림 시각이 올바르지 않습니다.' }, { status: 400 })
  }

  const updated = await prisma.reminder.update({
    where: { id },
    data: {
      title: typeof body.title === 'string' ? body.title.trim() : undefined,
      memo: body.memo !== undefined ? body.memo : undefined,
      repeatRule: body.repeatRule !== undefined ? body.repeatRule || null : undefined,
      repeatEndAt:
        body.repeatEndAt !== undefined
          ? body.repeatEndAt
            ? new Date(body.repeatEndAt)
            : null
          : undefined,
      leadMinutes: body.leadMinutes !== undefined ? body.leadMinutes : undefined,
      snoozeMinutes: body.snoozeMinutes !== undefined ? body.snoozeMinutes : undefined,
      ...(remindAt ? { remindAt } : {}),
    },
  })

  // 시각이나 미리 알림이 바뀌었으면 발송 예약을 다시 건다.
  const timingChanged =
    (remindAt && remindAt.getTime() !== current.remindAt.getTime()) ||
    (body.leadMinutes !== undefined && body.leadMinutes !== current.leadMinutes)

  if (timingChanged) {
    await prisma.notification.updateMany({
      where: { reminderId: id, status: { in: ['pending', 'sending'] } },
      data: { status: 'cancelled' },
    })
    await scheduleNotifications(id, updated.remindAt, updated.leadMinutes)
  }

  return NextResponse.json({ reminder: toDTO(updated) })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  await deleteReminder(id)
  return NextResponse.json({ ok: true })
}
