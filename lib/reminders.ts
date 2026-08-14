import { prisma } from './prisma'
import { enabledChannels } from './notifier'
import { nextOccurrence } from './repeat'

/// 내 것이 아닌 리마인더는 없는 것처럼 다룬다.
///
/// id 만 알면 남의 데이터를 고칠 수 있으면 안 되므로, 아래 함수들은 전부
/// 이 검사를 먼저 통과해야 한다. "권한 없음" 대신 "없음"으로 답하는 이유는
/// 그 id 가 존재한다는 사실조차 알려줄 필요가 없기 때문이다.
export class NotFoundError extends Error {
  constructor() {
    super('리마인더를 찾을 수 없습니다.')
    this.name = 'NotFoundError'
  }
}

async function requireOwned(id: number, userId: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } })
  if (!reminder) throw new NotFoundError()
  return reminder
}

export interface ReminderInput {
  title: string
  remindAt: Date
  memo?: string | null
  repeatRule?: string | null
  repeatEndAt?: Date | null
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

export async function createReminder(input: ReminderInput, userId: string) {
  const reminder = await prisma.reminder.create({
    data: {
      userId,
      title: input.title,
      memo: input.memo ?? null,
      remindAt: input.remindAt,
      repeatRule: input.repeatRule ?? null,
      repeatEndAt: input.repeatEndAt ?? null,
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
export async function rescheduleReminder(id: number, remindAt: Date, userId: string) {
  await requireOwned(id, userId)

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

/**
 * 반복 리마인더를 다음 회차로 옮긴다.
 *
 * 채널이 여러 개면(푸시·이메일) 같은 회차에 대해 이 함수가 여러 번 불린다.
 * `remindAt` 이 아직 방금 발송한 회차일 때만 옮기는 조건부 갱신이라,
 * 두 번째 호출은 아무 일도 하지 않는다. 회차를 건너뛰는 사고를 막는 장치다.
 *
 * 반환값은 새 회차 시각. 옮기지 않았으면 null.
 */
export async function advanceRepeat(reminderId: number, occurrenceAt: Date): Promise<Date | null> {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } })
  if (!reminder || !reminder.repeatRule || reminder.doneAt) return null

  const next = nextOccurrence(occurrenceAt, reminder.repeatRule, new Date(), reminder.repeatEndAt)

  if (!next) {
    // 종료일을 넘겼다. 규칙을 지워 더 이상 돌지 않게 한다.
    await prisma.reminder.updateMany({
      where: { id: reminderId, remindAt: occurrenceAt },
      data: { repeatRule: null },
    })
    return null
  }

  const { count } = await prisma.reminder.updateMany({
    where: { id: reminderId, remindAt: occurrenceAt, doneAt: null },
    data: { remindAt: next },
  })
  if (count !== 1) return null // 다른 채널이 이미 옮겼다

  await scheduleNotifications(reminderId, next, reminder.leadMinutes)
  return next
}

/**
 * 알림에서 '나중에'를 눌렀을 때. 지정한 분 뒤에 다시 알린다.
 *
 * 반복 여부에 따라 처리가 갈린다.
 *
 * - 1회성: 알림 시각 자체를 옮긴다. 목록에도 새 시각으로 보이는 게 자연스럽다.
 * - 반복:  remindAt 을 건드리지 않고 일회성 알림만 하나 더 만든다.
 *          매일 09시 알림을 15분 미뤘다고 내일부터 09시 15분이 되면 안 된다.
 */
export async function snoozeReminder(id: number, userId: string, minutes?: number) {
  const reminder = await requireOwned(id, userId)

  const wait = minutes ?? reminder.snoozeMinutes
  const at = new Date(Date.now() + wait * 60_000)

  if (!reminder.repeatRule) {
    // 예정 시각이 아직 더 뒤라면 그대로 둔다. 미루기가 앞당기기가 되면 안 된다.
    if (reminder.remindAt.getTime() > at.getTime()) return reminder
    return rescheduleReminder(id, at, userId)
  }

  // occurrenceAt 을 미룬 시각 자체로 두면 여러 번 미뤄도 서로 부딪히지 않는다.
  await prisma.notification.createMany({
    data: enabledChannels().map((channel) => ({
      reminderId: id,
      occurrenceAt: at,
      kind: 'snooze',
      channel,
      scheduledAt: at,
    })),
    skipDuplicates: true,
  })

  return reminder
}

export async function completeReminder(id: number, done: boolean, userId: string) {
  const target = await requireOwned(id, userId)

  // 반복 리마인더를 완료하면 없애는 게 아니라 다음 회차로 넘긴다.
  // 매일 먹는 약을 오늘 체크했다고 내일치가 사라지면 안 된다.
  if (done && target.repeatRule) {
    const next = nextOccurrence(target.remindAt, target.repeatRule, new Date(), target.repeatEndAt)
    if (next) {
      await prisma.notification.updateMany({
        where: { reminderId: id, status: { in: ['pending', 'sending'] } },
        data: { status: 'cancelled' },
      })
      const moved = await prisma.reminder.update({ where: { id }, data: { remindAt: next } })
      await scheduleNotifications(id, next, moved.leadMinutes)
      return moved
    }
    // 다음 회차가 없으면(종료일 지남) 아래로 내려가 그대로 완료 처리한다.
  }

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

export async function listReminders(userId: string, done = false) {
  return prisma.reminder.findMany({
    where: { userId, doneAt: done ? { not: null } : null },
    orderBy: { remindAt: done ? 'desc' : 'asc' },
  })
}

export async function deleteReminder(id: number, userId: string) {
  await requireOwned(id, userId)
  // Notification 은 onDelete: Cascade 라 같이 지워진다.
  await prisma.reminder.delete({ where: { id } })
}
