import { prisma } from './prisma'
import { enabledChannels } from './notifier'

const DEFAULT_USER = 'local'

export interface ReminderInput {
  title: string
  remindAt: Date
  memo?: string | null
  repeatRule?: string | null
  leadMinutes?: number | null
  snoozeMinutes?: number
  autoComplete?: boolean
}

/**
 * 리마인더 한 건에 대한 발송 예약을 만든다.
 *
 * 켜져 있는 채널마다 한 건씩 만들고, 미리 알림이 설정돼 있으면 그 건도 함께 만든다.
 * skipDuplicates 와 스키마의 유니크 제약이 겹쳐서, 이 함수를 몇 번 호출해도
 * 같은 회차에 대한 알림은 하나만 남는다.
 */
export async function scheduleNotifications(
  reminderId: number,
  occurrenceAt: Date,
  leadMinutes?: number | null,
) {
  const rows = enabledChannels().flatMap((channel) => {
    const list = [
      { reminderId, occurrenceAt, kind: 'main', channel, scheduledAt: occurrenceAt },
    ]
    if (leadMinutes && leadMinutes > 0) {
      list.push({
        reminderId,
        occurrenceAt,
        kind: 'lead',
        channel,
        scheduledAt: new Date(occurrenceAt.getTime() - leadMinutes * 60_000),
      })
    }
    return list
  })

  await prisma.notification.createMany({ data: rows, skipDuplicates: true })
}

export async function createReminder(input: ReminderInput, userId = DEFAULT_USER) {
  const reminder = await prisma.reminder.create({
    data: {
      userId,
      title: input.title,
      memo: input.memo ?? null,
      remindAt: input.remindAt,
      repeatRule: input.repeatRule ?? null,
      leadMinutes: input.leadMinutes ?? null,
      snoozeMinutes: input.snoozeMinutes ?? 15,
      autoComplete: input.autoComplete ?? false,
    },
  })

  await scheduleNotifications(reminder.id, reminder.remindAt, reminder.leadMinutes)
  return reminder
}

/**
 * 알림 시각을 옮긴다. 목록에서 "+5분"을 누르는 동작이 이것이다.
 *
 * 화면만 바꾸는 게 아니라 서버의 발송 예약을 다시 잡아야 한다.
 * 이미 보낸 건(sent)은 건드리지 않고, 아직 안 보낸 건만 취소한 뒤 새로 건다.
 */
export async function rescheduleReminder(id: number, remindAt: Date) {
  const reminder = await prisma.reminder.update({
    where: { id },
    data: { remindAt },
  })

  await prisma.notification.updateMany({
    where: { reminderId: id, status: { in: ['pending', 'sending'] } },
    data: { status: 'cancelled' },
  })

  await scheduleNotifications(id, remindAt, reminder.leadMinutes)
  return reminder
}

export async function completeReminder(id: number, done = true) {
  const reminder = await prisma.reminder.update({
    where: { id },
    data: { doneAt: done ? new Date() : null },
  })

  if (done) {
    // 완료했으면 아직 안 나간 알림은 보낼 이유가 없다.
    await prisma.notification.updateMany({
      where: { reminderId: id, status: 'pending' },
      data: { status: 'cancelled' },
    })
  } else {
    await scheduleNotifications(id, reminder.remindAt, reminder.leadMinutes)
  }

  return reminder
}

export async function listReminders(userId = DEFAULT_USER, done = false) {
  return prisma.reminder.findMany({
    where: { userId, doneAt: done ? { not: null } : null },
    orderBy: { remindAt: done ? 'desc' : 'asc' },
  })
}

export async function deleteReminder(id: number) {
  // Notification 은 onDelete: Cascade 라 같이 지워진다.
  await prisma.reminder.delete({ where: { id } })
}
