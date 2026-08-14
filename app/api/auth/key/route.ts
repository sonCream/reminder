import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  createSession,
  resolveKey,
  sessionCookieOptions,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * 키를 세션으로 바꾼다.
 *
 * 앱을 열 때마다 호출된다. 키는 기기에 보관되고, 요청마다 실려 다니지 않는다.
 * 실제 요청 인증은 이 응답으로 심은 쿠키가 담당한다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const key = String(body?.key ?? '')

  const userId = await resolveKey(key)
  if (!userId) {
    // 키가 틀렸거나, 서버 데이터가 초기화됐다.
    // 여기서 새 계정을 만들어 주면 사용자는 데이터가 사라진 걸 눈치채지 못한다.
    return NextResponse.json({ error: '키에 해당하는 계정이 없습니다.' }, { status: 404 })
  }

  const sessionId = await createSession(userId, request.headers.get('user-agent'))

  const response = NextResponse.json({ userId })
  response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions())
  return response
}
