'use client'

/**
 * 기기에 보관하는 계정 키.
 *
 * 이 값이 곧 계정이다. 서버에는 해시만 있어서, 여기서 잃으면 되찾을 방법이 없다.
 *
 * ⚠️ iOS 사파리는 7일 이상 방문하지 않은 사이트의 저장소를 비운다.
 *    홈 화면에 추가한 앱은 예외이므로, 이 앱에서 홈 화면 추가는 권장이 아니라 사실상 필수다.
 */

const KEY_STORAGE = 'reminder.accountKey'

export function readKey(): string | null {
  try {
    return window.localStorage.getItem(KEY_STORAGE)
  } catch {
    // 사생활 보호 모드 등에서 저장소 접근이 막힐 수 있다.
    return null
  }
}

export function writeKey(key: string): boolean {
  try {
    window.localStorage.setItem(KEY_STORAGE, key)
    return true
  } catch {
    return false
  }
}

export function clearKey(): void {
  try {
    window.localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* 무시 */
  }
}

export type BootstrapResult =
  /// 기존 키로 세션을 얻었다.
  | { status: 'ok' }
  /// 키가 없어 새 계정을 만들었다. 처음 실행한 경우다.
  | { status: 'created'; key: string }
  /// 키는 있는데 서버가 모른다. 자동으로 새 계정을 만들지 않는다 —
  /// 그러면 사용자는 데이터가 사라진 사실을 눈치채지 못한 채 빈 앱을 쓰게 된다.
  | { status: 'unknown-key' }
  | { status: 'storage-blocked' }
  | { status: 'error'; reason: string }

async function exchange(key: string): Promise<'ok' | 'unknown' | 'error'> {
  try {
    const response = await fetch('/api/auth/key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (response.ok) return 'ok'
    if (response.status === 404) return 'unknown'
    return 'error'
  } catch {
    return 'error'
  }
}

/// 앱을 열 때 한 번 호출한다. 키가 있으면 세션으로 바꾸고, 없으면 계정을 만든다.
export async function bootstrapSession(): Promise<BootstrapResult> {
  const existing = readKey()

  if (existing) {
    const result = await exchange(existing)
    if (result === 'ok') return { status: 'ok' }
    if (result === 'unknown') return { status: 'unknown-key' }
    return { status: 'error', reason: '서버에 연결하지 못했습니다.' }
  }

  try {
    const response = await fetch('/api/auth/key/new', { method: 'POST' })
    if (!response.ok) return { status: 'error', reason: '계정을 만들지 못했습니다.' }

    const data = (await response.json()) as { key: string }
    if (!writeKey(data.key)) return { status: 'storage-blocked' }

    return { status: 'created', key: data.key }
  } catch {
    return { status: 'error', reason: '서버에 연결하지 못했습니다.' }
  }
}

/// 다른 기기에서 받은 키로 붙는다.
export async function importKey(raw: string): Promise<{ ok: boolean; reason?: string }> {
  const key = raw.replace(/\s+/g, '')
  if (key.length === 0) return { ok: false, reason: '키를 입력해 주세요.' }

  const result = await exchange(key)
  if (result === 'unknown') return { ok: false, reason: '이 키에 해당하는 계정이 없습니다.' }
  if (result === 'error') return { ok: false, reason: '서버에 연결하지 못했습니다.' }

  if (!writeKey(key)) return { ok: false, reason: '이 브라우저는 저장소를 쓸 수 없습니다.' }
  return { ok: true }
}

/// 키를 새로 발급받는다. 이전 키와 다른 기기의 세션은 무효가 된다.
export async function rotateKey(): Promise<{ ok: boolean; key?: string; reason?: string }> {
  try {
    const response = await fetch('/api/auth/key/rotate', { method: 'POST' })
    if (!response.ok) return { ok: false, reason: '키를 새로 만들지 못했습니다.' }

    const data = (await response.json()) as { key: string }
    if (!writeKey(data.key)) return { ok: false, reason: '새 키를 저장하지 못했습니다.' }

    return { ok: true, key: data.key }
  } catch {
    return { ok: false, reason: '서버에 연결하지 못했습니다.' }
  }
}
