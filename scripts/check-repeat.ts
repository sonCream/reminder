import { nextOccurrence, repeatLabel } from '../lib/repeat'

/**
 * 반복 날짜 계산 검증.
 *   npx tsx scripts/check-repeat.ts
 *
 * 말일·윤년·주말 건너뛰기처럼 눈으로는 잘 안 잡히는 경우를 모아뒀다.
 */

/// KST 시각을 UTC Date 로 만든다.
const kst = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h - 9, min))

/// UTC Date 를 KST 문자열로 읽는다.
const show = (d: Date | null) => {
  if (!d) return 'null'
  const l = new Date(d.getTime() + 9 * 3600_000)
  const day = ['일', '월', '화', '수', '목', '금', '토'][l.getUTCDay()]
  const p = (n: number) => String(n).padStart(2, '0')
  return `${l.getUTCFullYear()}-${p(l.getUTCMonth() + 1)}-${p(l.getUTCDate())}(${day}) ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}`
}

interface Case {
  name: string
  from: Date
  rule: string
  after: Date
  endAt?: Date
  expect: string
}

const cases: Case[] = [
  {
    name: '매일',
    from: kst(2026, 8, 12, 9), rule: 'daily', after: kst(2026, 8, 12, 10),
    expect: '2026-08-13(목) 09:00',
  },
  {
    name: '평일만 — 금요일 다음은 월요일',
    from: kst(2026, 8, 14, 9), rule: 'weekday', after: kst(2026, 8, 14, 10),
    expect: '2026-08-17(월) 09:00',
  },
  {
    name: '평일만 — 이른 아침(07:00 KST = 전날 22:00 UTC)',
    from: kst(2026, 8, 14, 7), rule: 'weekday', after: kst(2026, 8, 14, 8),
    expect: '2026-08-17(월) 07:00',
  },
  {
    name: '매주 — 같은 요일 유지',
    from: kst(2026, 8, 12, 9), rule: 'weekly', after: kst(2026, 8, 12, 10),
    expect: '2026-08-19(수) 09:00',
  },
  {
    name: '매월 — 1월 31일은 2월 28일로',
    from: kst(2026, 1, 31, 9), rule: 'monthly', after: kst(2026, 1, 31, 10),
    expect: '2026-02-28(토) 09:00',
  },
  {
    name: '매월 — 말일이 아닌 날',
    from: kst(2026, 8, 15, 8), rule: 'monthly', after: kst(2026, 8, 15, 9),
    expect: '2026-09-15(화) 08:00',
  },
  {
    name: '매년 — 윤년 2월 29일은 평년 2월 28일로',
    from: kst(2028, 2, 29, 9), rule: 'yearly', after: kst(2028, 2, 29, 10),
    expect: '2029-02-28(수) 09:00',
  },
  {
    name: '밀린 회차는 건너뛰고 앞으로 올 것 하나만',
    from: kst(2026, 8, 1, 9), rule: 'daily', after: kst(2026, 8, 10, 12),
    expect: '2026-08-11(화) 09:00',
  },
  {
    name: '종료일을 넘기면 null',
    from: kst(2026, 8, 12, 9), rule: 'daily', after: kst(2026, 8, 12, 10),
    endAt: kst(2026, 8, 12, 23, 59),
    expect: 'null',
  },
  {
    name: '예전 한글 규칙도 인식',
    from: kst(2026, 8, 12, 9), rule: '매일', after: kst(2026, 8, 12, 10),
    expect: '2026-08-13(목) 09:00',
  },
]

let failed = 0
for (const c of cases) {
  const got = show(nextOccurrence(c.from, c.rule, c.after, c.endAt ?? null))
  const ok = got === c.expect
  if (!ok) failed += 1
  console.log(`${ok ? '  OK' : 'FAIL'}  ${c.name}`)
  if (!ok) console.log(`        기대 ${c.expect}\n        실제 ${got}`)
}

console.log('\n--- 표시 문구 ---')
for (const rule of ['daily', 'weekday', 'weekly', 'monthly', 'yearly']) {
  console.log(`  ${rule.padEnd(8)} → ${repeatLabel(rule, kst(2026, 8, 15, 8))}`)
}

console.log(`\n${cases.length - failed}/${cases.length} 통과`)
process.exit(failed === 0 ? 0 : 1)
