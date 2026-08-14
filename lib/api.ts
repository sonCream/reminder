import { NextResponse } from 'next/server'
import { UnauthorizedError } from './auth'
import { NotFoundError } from './reminders'

/// 예외를 알맞은 응답으로 바꾼다.
/// 예상 못 한 오류의 내용은 밖으로 내보내지 않는다 — 서버 구조가 드러난다.
export function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  console.error('[api]', error)
  return NextResponse.json({ error: '처리 중 문제가 발생했습니다.' }, { status: 500 })
}
