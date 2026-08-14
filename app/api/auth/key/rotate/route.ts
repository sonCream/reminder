import { NextResponse } from 'next/server'
import { requireUser, rotateKey } from '@/lib/auth'
import { errorResponse } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * 키를 새로 발급하고 이전 키를 무효로 만든다.
 *
 * 키가 유출됐을 때 쓰는 수단이다. 지금 기기의 세션만 남기고
 * 다른 기기의 세션은 모두 끊는다 — 그래야 실제로 되찾는 것이 된다.
 */
export async function POST() {
  try {
    const user = await requireUser()
    const key = await rotateKey(user.id, user.sessionId)
    return NextResponse.json({ key })
  } catch (error) {
    return errorResponse(error)
  }
}
