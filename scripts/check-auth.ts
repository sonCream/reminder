import { emailAllowed } from '../lib/auth'

/**
 * 로그인 허용 범위 판정 검증.
 *   npx tsx scripts/check-auth.ts
 */

interface Case {
  name: string
  domains?: string
  emails?: string
  email: string
  expect: boolean
}

const cases: Case[] = [
  { name: '아무것도 설정 안 하면 전부 허용', email: 'anyone@example.com', expect: true },

  { name: '회사 도메인 허용', domains: 'creamhouse.net', email: 'kim@creamhouse.net', expect: true },
  { name: '다른 도메인 차단', domains: 'creamhouse.net', email: 'kim@gmail.com', expect: false },
  { name: '대소문자 무시', domains: 'creamhouse.net', email: 'Kim@CreamHouse.NET', expect: true },
  { name: '앞뒤 공백 무시', domains: ' creamhouse.net ', email: 'kim@creamhouse.net', expect: true },
  { name: '@ 를 붙여 써도 인식', domains: '@creamhouse.net', email: 'kim@creamhouse.net', expect: true },
  { name: '도메인 여러 개', domains: 'creamhouse.net,partner.com', email: 'lee@partner.com', expect: true },

  { name: '개별 주소 허용', emails: 'guest@gmail.com', email: 'guest@gmail.com', expect: true },
  { name: '개별 주소 목록에 없으면 차단', emails: 'guest@gmail.com', email: 'other@gmail.com', expect: false },

  { name: '도메인과 개별 주소 병행 — 도메인 쪽', domains: 'creamhouse.net', emails: 'guest@gmail.com', email: 'kim@creamhouse.net', expect: true },
  { name: '도메인과 개별 주소 병행 — 개별 쪽', domains: 'creamhouse.net', emails: 'guest@gmail.com', email: 'guest@gmail.com', expect: true },
  { name: '도메인과 개별 주소 병행 — 둘 다 아님', domains: 'creamhouse.net', emails: 'guest@gmail.com', email: 'stranger@naver.com', expect: false },

  { name: '부분 일치로 뚫리지 않음', domains: 'creamhouse.net', email: 'kim@notcreamhouse.net', expect: false },
]

let failed = 0
for (const c of cases) {
  process.env.AUTH_ALLOWED_DOMAINS = c.domains ?? ''
  process.env.AUTH_ALLOWED_EMAILS = c.emails ?? ''

  const got = emailAllowed(c.email)
  const ok = got === c.expect
  if (!ok) failed += 1
  console.log(`${ok ? '  OK' : 'FAIL'}  ${c.name}`)
  if (!ok) console.log(`        기대 ${c.expect} / 실제 ${got}`)
}

console.log(`\n${cases.length - failed}/${cases.length} 통과`)
process.exit(failed === 0 ? 0 : 1)
