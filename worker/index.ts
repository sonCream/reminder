import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { getNotifier } from '../lib/notifier'
import { advanceRepeat } from '../lib/reminders'

/// 한 번에 처리할 최대 건수. 밀린 알림이 많아도 한 틱이 무한정 길어지지 않게 한다.
const BATCH = 50
/// 이 횟수만큼 실패하면 포기하고 failed로 둔다.
const MAX_ATTEMPTS = 3

/**
 * pending → sending 으로 조건부 갱신.
 *
 * 갱신된 행이 0이면 다른 워커(또는 이전 틱)가 이미 집어간 것이므로 건너뛴다.
 * 이 한 줄이 "같은 알림이 두 번 발송되는" 사고를 막는다.
 */
async function claim(id: number): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'sending', attempts: { increment: 1 } },
  })
  return count === 1
}

/// 앱 아이콘 배지에 올릴 숫자 — 시각이 지났는데 아직 완료하지 않은 리마인더 수.
async function badgeCount(userId: string): Promise<number> {
  return prisma.reminder.count({
    where: { userId, doneAt: null, remindAt: { lte: new Date() } },
  })
}

async function tick(): Promise<void> {
  const now = new Date()

  // 핵심: "지금 시각"이 아니라 "예정 시각이 지났는데 아직 안 보낸 것 전부"를 찾는다.
  // 이래야 서버가 30분 죽어 있었어도 재가동 시 밀린 알림이 자동으로 나간다.
  const due = await prisma.notification.findMany({
    where: { status: 'pending', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: BATCH,
    include: { reminder: true },
  })

  if (due.length === 0) return
  console.log(`[worker] 발송 대상 ${due.length}건`)

  for (const n of due) {
    if (!(await claim(n.id))) continue

    try {
      const notifier = getNotifier(n.channel)
      await notifier.send({
        userId: n.reminder.userId,
        reminderId: n.reminderId,
        title: n.reminder.title,
        // 메모가 없으면 본문을 비운다. 채우려고 넣은 안내 문구는
        // 매번 똑같이 반복돼서 정작 제목을 읽는 데 방해가 된다.
        body: n.reminder.memo ?? '',
        url: `/?reminder=${n.reminderId}`,
        badgeCount: await badgeCount(n.reminder.userId),
        snoozeMinutes: n.reminder.snoozeMinutes,
        // 발송 건 id 를 그대로 쓴다. 회차마다 다르고, 같은 건을 재시도할 때는 같다.
        tagKey: String(n.id),
      })

      await prisma.notification.update({
        where: { id: n.id },
        data: { status: 'sent', sentAt: new Date(), error: null },
      })
      console.log(`[worker] 발송 완료 #${n.id} (${n.channel}) ${n.reminder.title}`)

      // 본 알림을 보냈으면 반복 리마인더를 다음 회차로 넘긴다.
      // 미리 알림(lead)에서 넘기면 정작 본 알림이 사라지므로 kind 를 구분한다.
      if (n.kind === 'main') {
        const next = await advanceRepeat(n.reminderId, n.occurrenceAt)
        if (next) {
          console.log(`[worker] 다음 회차 예약 #${n.reminderId} → ${next.toISOString()}`)
        }
      }
    } catch (err) {
      const attempts = n.attempts + 1
      const giveUp = attempts >= MAX_ATTEMPTS
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          // 아직 여유가 있으면 pending으로 되돌려 다음 틱에 다시 시도한다.
          status: giveUp ? 'failed' : 'pending',
          error: String(err),
        },
      })
      console.error(`[worker] 발송 실패 #${n.id} (${attempts}/${MAX_ATTEMPTS})`, err)
    }
  }
}

async function main() {
  const schedule = process.env.WORKER_CRON ?? '* * * * *'
  const once = process.argv.includes('--once')

  console.log(`[worker] 시작 — 채널=${process.env.NOTIFIER_CHANNELS ?? 'console'}`)

  // 시작하자마자 한 번 훑는다. 서버가 꺼져 있던 동안 밀린 건을 바로 복구하기 위해서다.
  await tick()

  if (once) {
    await prisma.$disconnect()
    return
  }

  cron.schedule(schedule, () => {
    tick().catch((e) => console.error('[worker] 틱 실패', e))
  })
  console.log(`[worker] 스케줄 등록 완료 (${schedule})`)

  const shutdown = async () => {
    console.log('[worker] 종료합니다')
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((e) => {
  console.error('[worker] 시작 실패', e)
  process.exit(1)
})
