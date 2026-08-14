import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { createReminder } from '../lib/reminders'

/**
 * 워커가 반복 리마인더를 다음 회차로 넘기는지 확인하는 준비 스크립트.
 *
 *   npx tsx scripts/check-repeat-e2e.ts        ← 데이터 준비
 *   npx tsx worker/index.ts --once             ← 발송
 *   npx tsx scripts/check-repeat-e2e.ts --show ← 결과 확인
 */

const show = (d: Date) => {
  const l = new Date(d.getTime() + 9 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  const day = ['일', '월', '화', '수', '목', '금', '토'][l.getUTCDay()]
  return `${p(l.getUTCMonth() + 1)}-${p(l.getUTCDate())}(${day}) ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}`
}

async function report() {
  const reminders = await prisma.reminder.findMany({
    where: { userId: 'local' },
    orderBy: { id: 'asc' },
    include: { notifications: { orderBy: { id: 'asc' } } },
  })

  for (const r of reminders) {
    console.log(`\n#${r.id} ${r.title}  [${r.repeatRule ?? '반복 없음'}]  완료=${r.doneAt ? show(r.doneAt) : '아니오'}`)
    console.log(`  다음 알림 시각: ${show(r.remindAt)}`)
    for (const n of r.notifications) {
      console.log(`    ${String(n.id).padStart(3)} ${n.status.padEnd(9)} ${n.kind.padEnd(5)} ${n.channel.padEnd(7)} 회차=${show(n.occurrenceAt)}`)
    }
  }
}

async function main() {
  if (process.argv.includes('--show')) {
    await report()
    await prisma.$disconnect()
    return
  }

  await prisma.user.upsert({
    where: { id: 'local' },
    create: { id: 'local' },
    update: {},
  })
  await prisma.reminder.deleteMany({ where: { userId: 'local' } })

  // 1분 전으로 잡아 워커가 즉시 집어가게 한다.
  const due = new Date(Date.now() - 60_000)
  await createReminder({ title: '약 먹기', remindAt: due, repeatRule: 'daily' }, 'local')

  console.log('준비 완료. 아래를 차례로 실행하세요.\n')
  console.log('  npx tsx worker/index.ts --once')
  console.log('  npx tsx scripts/check-repeat-e2e.ts --show\n')
  await report()
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
