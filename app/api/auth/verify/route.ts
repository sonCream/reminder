import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  consumeLoginToken,
  createSession,
  findOrCreateUser,
  sessionCookieOptions,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

/// 메일의 링크를 누르면 여기로 온다. 토큰을 세션으로 바꿔주고 앱으로 보낸다.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing', url.origin))
  }

  const email = await consumeLoginToken(token)
  if (!email) {
    // 만료됐거나 이미 사용한 링크다.
    return NextResponse.redirect(new URL('/login?error=expired', url.origin))
  }

  const userId = await findOrCreateUser(email)
  const sessionId = await createSession(userId, request.headers.get('user-agent'))

  const response = NextResponse.redirect(new URL('/', url.origin))
  response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions())
  return response
}
