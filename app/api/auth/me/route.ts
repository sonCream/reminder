import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/// 현재 세션 정보. 키 자체는 절대 돌려주지 않는다 — 서버에 해시만 있어서 돌려줄 수도 없다.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ user: null })

  const [devices, createdAt] = await Promise.all([
    // 만료된 세션은 세지 않는다. 정리는 그 세션이 쓰일 때 일어나므로 남아 있을 수 있다.
    prisma.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
  ])

  return NextResponse.json({
    user: { id: user.id, devices, createdAt: createdAt?.createdAt ?? null },
  })
}
