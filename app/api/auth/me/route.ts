import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/// 현재 세션 정보. 키 자체는 절대 돌려주지 않는다 — 서버에 해시만 있어서 돌려줄 수도 없다.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ user: null })

  const [devices, createdAt] = await Promise.all([
    prisma.session.count({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
  ])

  return NextResponse.json({
    user: { id: user.id, devices, createdAt: createdAt?.createdAt ?? null },
  })
}
