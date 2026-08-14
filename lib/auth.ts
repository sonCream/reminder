import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { SESSION_COOKIE } from './session-cookie'

/**
 * 키 기반 익명 계정.
 *
 * 이메일도 비밀번호도 받지 않는다. 앱이 처음 실행될 때 서버가 무작위 키를 발급하고,
 * 기기가 그 키를 보관한다. 키를 가진 사람이 곧 그 계정이다.
 *
 * 서버는 이 계정이 누구인지 알지 못한다. 대신 키를 잃으면 복구할 방법이 없어서,
 * 설정 화면에서 키를 꺼내 백업하거나 다른 기기로 옮길 수 있게 해 둔다.
 */

export { SESSION_COOKIE }

const SESSION_DAYS = 30

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/// 손으로 옮겨 적을 때 섞여 들어가는 공백·줄바꿈을 걷어낸다.
export function normalizeKey(raw: string): string {
  return raw.replace(/\s+/g, '')
}

function generateKey(): string {
  return randomBytes(32).toString('base64url')
}

/* ---------------------------------------------------------------- */
/* 계정                                                              */
/* ---------------------------------------------------------------- */

export interface IssuedKey {
  userId: string
  /// ⚠️ 원본 키. 이 순간에만 존재한다. 서버에는 해시만 남는다.
  key: string
}

/// 새 계정을 만들고 키를 발급한다.
export async function createAccount(): Promise<IssuedKey> {
  const key = generateKey()
  const user = await prisma.user.create({
    data: { keyHash: sha256(key), lastLoginAt: new Date() },
  })
  return { userId: user.id, key }
}

/// 키에 해당하는 계정을 찾는다. 없으면 null.
export async function resolveKey(rawKey: string): Promise<string | null> {
  const key = normalizeKey(rawKey)
  if (key.length === 0) return null

  const user = await prisma.user.findUnique({ where: { keyHash: sha256(key) } })
  return user?.id ?? null
}

/**
 * 키를 새로 발급하고 이전 키를 무효로 만든다.
 *
 * 키가 유출됐을 때 계정을 버리지 않고 되찾는 유일한 수단이다.
 * 다른 기기의 세션도 함께 끊어야 실제로 되찾는 것이 된다.
 */
export async function rotateKey(userId: string, keepSessionId?: string): Promise<string> {
  const key = generateKey()
  await prisma.user.update({ where: { id: userId }, data: { keyHash: sha256(key) } })

  await prisma.session.deleteMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
  })

  return key
}

/// 지금 기기만 남기고 나머지 연결을 끊는다. 키는 그대로 쓴다.
export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { userId, id: { not: keepSessionId } },
  })
  return count
}

/// 아직 키가 없는 계정(인증 도입 전 데이터)에 키를 발급한다.
/// 서버에서 scripts/issue-key.ts 로만 실행한다 — 앱에서는 부르지 않는다.
export async function issueKeyForLegacyUser(userId: string): Promise<string> {
  const key = generateKey()
  await prisma.user.update({ where: { id: userId }, data: { keyHash: sha256(key) } })
  return key
}

/* ---------------------------------------------------------------- */
/* 세션                                                              */
/* ---------------------------------------------------------------- */

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const id = randomBytes(32).toString('base64url')

  await prisma.session.create({
    data: {
      id,
      userId,
      userAgent: userAgent ?? null,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    },
  })
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })

  return id
}

export interface SessionUser {
  id: string
  sessionId: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  if (!id) return null

  const session = await prisma.session.findUnique({ where: { id } })
  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {})
    return null
  }

  return { id: session.userId, sessionId: session.id }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('세션이 없습니다.')
    this.name = 'UnauthorizedError'
  }
}

/// API 라우트에서 쓴다. 세션이 없으면 예외를 던진다.
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const id = jar.get(SESSION_COOKIE)?.value
  if (id) await prisma.session.delete({ where: { id } }).catch(() => {})
  jar.delete(SESSION_COOKIE)
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  }
}

/// 만료된 세션 정리.
export async function cleanupExpired(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
}
