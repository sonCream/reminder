import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/api'
import { createReminder, listReminders } from '@/lib/reminders'
import { toDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const done = new URL(request.url).searchParams.get('done') === '1'
    const reminders = await listReminders(user.id, done)
    return NextResponse.json({ reminders: reminders.map(toDTO) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json()

    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 })
    }
    const remindAt = new Date(body.remindAt)
    if (Number.isNaN(remindAt.getTime())) {
      return NextResponse.json({ error: '알림 시각이 올바르지 않습니다.' }, { status: 400 })
    }

    const reminder = await createReminder(
      {
        title: body.title.trim(),
        memo: body.memo ?? null,
        remindAt,
        repeatRule: body.repeatRule || null,
        repeatEndAt: body.repeatEndAt ? new Date(body.repeatEndAt) : null,
        leadMinutes: body.leadMinutes ?? null,
        snoozeMinutes: body.snoozeMinutes ?? 15,
      },
      user.id,
    )

    return NextResponse.json({ reminder: toDTO(reminder) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
