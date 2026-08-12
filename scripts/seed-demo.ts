import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { createReminder } from '../lib/reminders'

/**
 * 스케줄러 검증용 데이터.
 *
 * 일부러 "이미 지난 시각"으로 한 건을 넣는다.
 * 워커가 이걸 집어내면 "서버가 죽어 있던 동안 밀린 알림을 복구한다"는 설계가 실제로 동작하는 것이다.
 */
async function main() {
  await prisma.reminder.deleteMany({ where: { userId: 'local' } })

  const now = Date.now()

  await createReminder({
    title: '영양제 챙겨 먹기',
    memo: '지난 알림 — 워커가 밀린 건을 잡아내는지 확인용',
    remindAt: new Date(now - 12 * 60 * 60_000), // 12시간 전
  })

  await createReminder({
    title: '치과 예약 확인 전화',
    memo: '담당 선생님 오후 진료만 가능',
    remindAt: new Date(now + 2 * 60_000), // 2분 뒤
  })

  await createReminder({
    title: '주간 회의',
    remindAt: new Date(now + 3 * 60 * 60_000), // 3시간 뒤
    leadMinutes: 10,
  })

  const reminders = await prisma.reminder.count({ where: { userId: 'local' } })
  const notifications = await prisma.notification.count()
  console.log(`리마인더 ${reminders}건, 발송 예약 ${notifications}건 생성`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
