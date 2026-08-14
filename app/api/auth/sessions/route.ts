import { NextResponse } from 'next/server'
import { requireUser, revokeOtherSessions } from '@/lib/auth'
import { errorResponse } from '@/lib/api'

export const dynamic = 'force-dynamic'

/// 지금 기기만 남기고 다른 연결을 끊는다.
/// 키를 바꿀 정도는 아니지만 정리하고 싶을 때 쓴다.
export async function DELETE() {
  try {
    const user = await requireUser()
    const removed = await revokeOtherSessions(user.id, user.sessionId)
    return NextResponse.json({ removed })
  } catch (error) {
    return errorResponse(error)
  }
}
