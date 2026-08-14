import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { SESSION_COOKIE } from './session-cookie'

/**
 * 매직 링크 인증.
 *
 * 비밀번호를 두지 않는다. 메일로 받은 1회용 링크를 눌러 본인임을 증명한다.
 * 저장하는 비밀이 없으니 유출될 것도, 재설정 화면도 필요 없다.
 */

export { SESSION_COOKIE }

const SESSION_DAYS = 30
const TOKEN_MINUTES = 15
/// 인증을 붙이기 전에 쌓인 데이터가 이 id 로 묶여 있다.
const LEGACY_USER_ID = 'local'
const LEGACY_EMAIL = 'local@unclaimed.invalid'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/// AUTH_ALLOWED_EMAILS 를 설정해 두면 그 주소만 로그인할 수 있다.
/// 비워 두면 누구나 자기 계정을 만들 수 있다.
export function emailAllowed(email: string): boolean {
  const list = (process.env.AUTH_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => normalizeEmail(s))
    .filter(Boolean)
  return list.length === 0 || list.includes(normalizeEmail(email))
}

/* ---------------------------------------------------------------- */
/* 로그인 토큰                                                        */
/* ---------------------------------------------------------------- */

/// 1회용 로그인 토큰을 만들고 원본을 돌려준다.
/// ⚠️ DB 에는 해시만 남는다. DB 를 볼 수 있어도 남의 계정에 로그인할 수 없다.
export async function createLoginToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')

  await prisma.loginToken.create({
    data: {
      email: normalizeEmail(email),
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
    },
  })

  return token
}

/// 토큰을 소모하고 이메일을 돌려준다. 이미 썼거나 만료됐으면 null.
export async function consumeLoginToken(token: string): Promise<string | null> {
  const row = await prisma.loginToken.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null

  // 조건부 갱신이라 링크를 두 번 눌러도 한 번만 통과한다.
  const { count } = await prisma.loginToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (count !== 1) return null

  return row.email
}

/* ---------------------------------------------------------------- */
/* 사용자 · 세션                                                      */
/* ---------------------------------------------------------------- */

/**
 * 이메일로 사용자를 찾거나 만든다.
 *
 * 인증을 붙이기 전에 쌓인 데이터는 'local' 계정에 묶여 있다.
 * 그 데이터를 아무나 가져가면 안 되므로 AUTH_OWNER_EMAIL 로 주인을 지정한다.
 * 설정하지 않으면 첫 로그인이 가져간다 — 개발 편의를 위한 기본값이라,
 * 운영에서는 반드시 설정해야 한다.
 */
export async function findOrCreateUser(email: string): Promise<string> {
  const normalized = normalizeEmail(email)

  const existing = await prisma.user.findUnique({ where: { email: normalized } })
  if (existing) return existing.id

  const owner = process.env.AUTH_OWNER_EMAIL
  const mayClaim = !owner || normalizeEmail(owner) === normalized

  if (mayClaim) {
    const legacy = await prisma.user.findUnique({ where: { id: LEGACY_USER_ID } })
    if (legacy && legacy.email === LEGACY_EMAIL) {
      const claimed = await prisma.user.update({
        where: { id: LEGACY_USER_ID },
        data: { email: normalized },
      })
      return claimed.id
    }
  }

  const created = await prisma.user.create({ data: { email: normalized } })
  return created.id
}

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
  email: string
}

/// 현재 요청의 로그인 사용자. 없으면 null.
export async function getSessionUser(): Promise<SessionUser | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  if (!id) return null

  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } })
  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {})
    return null
  }

  return { id: session.user.id, email: session.user.email }
}

/// API 라우트에서 쓴다. 로그인하지 않았으면 예외를 던진다.
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export class UnauthorizedError extends Error {
  constructor() {
    super('로그인이 필요합니다.')
    this.name = 'UnauthorizedError'
  }
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

/// 만료된 세션·토큰 정리. 워커가 주기적으로 부른다.
export async function cleanupExpired(): Promise<void> {
  const now = new Date()
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })
  await prisma.loginToken.deleteMany({ where: { expiresAt: { lt: now } } })
}

/// 타이밍 차이로 토큰을 추측하지 못하게 한다.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
