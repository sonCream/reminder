import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from './lib/session-cookie'

/**
 * 로그인하지 않은 요청을 막는다.
 *
 * 여기서는 쿠키가 있는지만 본다. 실제 세션 검증은 DB 조회가 필요한데
 * 미들웨어는 Edge 런타임이라 Prisma 를 쓸 수 없다.
 * 위조된 쿠키는 API 라우트의 requireUser() 에서 걸러진다.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next()

  // API 는 리다이렉트 대신 상태 코드로 답한다.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const login = new URL('/login', request.url)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    /*
     * 아래는 로그인 없이도 닿을 수 있어야 한다.
     * - login, api/auth : 로그인 자체를 위한 경로
     * - sw.js, manifest, icons : PWA 설치와 서비스 워커 등록에 필요
     */
    '/((?!_next/static|_next/image|favicon\\.ico|apple-touch-icon\\.png|icons|manifest\\.webmanifest|sw\\.js|login|api/auth).*)',
  ],
}
