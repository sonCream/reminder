import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createAccount, createSession, sessionCookieOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * 새 계정을 만들고 키를 발급한다. 앱을 처음 실행할 때만 호출된다.
 *
 * ⚠️ 응답의 key 는 이때 한 번만 서버 밖으로 나간다. 서버에는 해시만 남는다.
 *    기기가 이 값을 저장하지 못하면 그 계정은 영영 접근할 수 없다.
 */
export async function POST(request: Request) {
  const { userId, key } = await createAccount()
  const sessionId = await createSession(userId, request.headers.get('user-agent'))

  const response = NextResponse.json({ userId, key })
  response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions())
  return response
}
