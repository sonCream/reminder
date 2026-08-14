import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { issueKeyForLegacyUser } from '../lib/auth'

/**
 * 아직 키가 없는 계정에 키를 발급한다.
 *
 *   npx tsx scripts/issue-key.ts            ← 키 없는 계정 목록 확인
 *   npx tsx scripts/issue-key.ts <계정id>   ← 그 계정에 키 발급
 *
 * 인증을 붙이기 전에 쌓인 데이터는 'local' 계정에 묶여 있다.
 * 앱이 알아서 가져가게 하면 주소를 아는 아무나 그 데이터를 차지할 수 있으므로,
 * 서버에서 이 스크립트로 키를 뽑아 직접 앱에 넣는 방식으로 인계한다.
 */
async function main() {
  const target = process.argv[2]

  if (!target) {
    const pending = await prisma.user.findMany({
      where: { keyHash: null },
      select: { id: true, createdAt: true, _count: { select: { reminders: true } } },
      orderBy: { createdAt: 'asc' },
    })

    if (pending.length === 0) {
      console.log('키가 없는 계정이 없습니다.')
    } else {
      console.log('키가 없는 계정:\n')
      for (const u of pending) {
        console.log(`  ${u.id}   리마인더 ${u._count.reminders}건   생성 ${u.createdAt.toISOString()}`)
      }
      console.log('\n키를 발급하려면:  npx tsx scripts/issue-key.ts <계정id>')
    }
    await prisma.$disconnect()
    return
  }

  const user = await prisma.user.findUnique({ where: { id: target } })
  if (!user) {
    console.error(`계정을 찾을 수 없습니다: ${target}`)
    process.exit(1)
  }
  if (user.keyHash) {
    console.error('이 계정에는 이미 키가 있습니다. 앱의 설정 → 키 새로 만들기를 쓰세요.')
    process.exit(1)
  }

  const key = await issueKeyForLegacyUser(target)

  console.log(`
계정 ${target} 의 키를 발급했습니다.

  ${key}

앱을 열고 "다른 기기에서 쓰던 키가 있어요" → 이 값을 붙여 넣으면 기존 데이터가 보입니다.
⚠️ 이 값은 지금 한 번만 표시됩니다. 서버에는 해시만 남습니다.
`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
