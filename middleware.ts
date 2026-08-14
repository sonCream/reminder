import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from './lib/session-cookie'

/**
 * 세션 없는 API 요청을 막는다.
 *
 * 화면은 막지 않는다. 로그인 화면이 따로 없고, 앱이 열리면서 스스로 세션을 만들기
 * 때문이다. 화면 자체에는 아무 데이터도 들어 있지 않고, 데이터는 전부 API 로 온다.
 *
 * 여기서는 쿠키가 있는지만 본다. 실제 검증은 DB 조회가 필요한데 미들웨어는
 * Edge 런타임이라 Prisma 를 쓸 수 없다. 위조 쿠키는 API 의 requireUser() 에서 걸린다.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next()
  return NextResponse.json({ error: '세션이 없습니다.' }, { status: 401 })
}

export const config = {
  // /api/auth/* 는 세션을 만드는 통로라 제외한다.
  matcher: ['/api/((?!auth).*)'],
}
