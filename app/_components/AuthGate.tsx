'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { bootstrapSession, clearKey, importKey } from '@/lib/auth-client'
import { KeyBox } from './KeyBox'

type Phase =
  | { name: 'checking' }
  /// 처음 실행이라 계정을 새로 만들었다. 키를 한 번 보여주고 넘어간다.
  | { name: 'created'; key: string }
  /// 저장된 키를 서버가 모른다. 자동으로 새로 만들지 않는다 —
  /// 그러면 데이터가 사라진 걸 모른 채 빈 앱을 쓰게 된다.
  | { name: 'unknown-key' }
  | { name: 'blocked' }
  | { name: 'error'; reason: string }
  | { name: 'ready' }

/**
 * 앱이 열릴 때 계정을 준비한다.
 *
 * 로그인 화면이 따로 없다. 키가 있으면 조용히 세션으로 바꾸고,
 * 없으면 계정을 만들어 키를 한 번 보여준다.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' })
  const [importing, setImporting] = useState(false)
  const [input, setInput] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const start = useCallback(async () => {
    const result = await bootstrapSession()
    switch (result.status) {
      case 'ok': return setPhase({ name: 'ready' })
      case 'created': return setPhase({ name: 'created', key: result.key })
      case 'unknown-key': return setPhase({ name: 'unknown-key' })
      case 'storage-blocked': return setPhase({ name: 'blocked' })
      default: return setPhase({ name: 'error', reason: result.reason })
    }
  }, [])

  useEffect(() => {
    void start()
  }, [start])

  async function submitImport() {
    setBusy(true)
    setImportError(null)
    const result = await importKey(input)
    setBusy(false)

    if (!result.ok) {
      setImportError(result.reason ?? '키를 확인해 주세요.')
      return
    }
    setPhase({ name: 'ready' })
  }

  if (phase.name === 'ready') return <>{children}</>

  /* ---------- 키 가져오기 ---------- */
  if (importing) {
    return (
      <main className="gate">
        <div className="gate-card">
          <h1>키 가져오기</h1>
          <p className="gate-sub">다른 기기의 설정 화면에서 꺼낸 키를 붙여 넣으세요.</p>

          <textarea
            rows={3}
            value={input}
            placeholder="계정 키"
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />

          {importError && <p className="notice">{importError}</p>}

          <button className="action-btn" onClick={submitImport} disabled={busy || input.trim() === ''}>
            {busy ? '확인 중…' : '이 키로 연결하기'}
          </button>
          <button className="gate-link" onClick={() => setImporting(false)}>
            돌아가기
          </button>
        </div>
      </main>
    )
  }

  /* ---------- 처음 실행 ---------- */
  if (phase.name === 'created') {
    return (
      <main className="gate">
        <div className="gate-card">
          <h1>시작하기 전에</h1>
          <p className="gate-sub">
            이 앱은 가입도 로그인도 없습니다. 대신 아래 키가 계정을 대신합니다.
            <br />
            <b>지금 복사해서 안전한 곳에 보관해 주세요.</b>
          </p>

          <KeyBox value={phase.key} />

          <p className="gate-sub">
            나중에 <b>설정 → 계정</b>에서 다시 꺼낼 수 있습니다.
          </p>

          <button className="action-btn" onClick={() => setPhase({ name: 'ready' })}>
            보관했습니다. 시작하기
          </button>
          <button
            className="gate-link"
            onClick={() => {
              // 새로 만든 계정은 버리고 기존 키로 붙는다.
              clearKey()
              setImporting(true)
            }}
          >
            다른 기기에서 쓰던 키가 있어요
          </button>
        </div>
      </main>
    )
  }

  /* ---------- 저장된 키를 서버가 모름 ---------- */
  if (phase.name === 'unknown-key') {
    return (
      <main className="gate">
        <div className="gate-card">
          <h1>계정을 찾지 못했습니다</h1>
          <p className="gate-sub">
            이 기기에 저장된 키에 해당하는 계정이 서버에 없습니다.
            <br />
            키를 다시 넣거나, 새로 시작할 수 있습니다.
          </p>
          <button className="action-btn" onClick={() => setImporting(true)}>
            키 입력하기
          </button>
          <button
            className="gate-link"
            onClick={() => {
              // ⚠️ 이전 데이터와의 연결을 끊는다. 되돌릴 수 없다.
              clearKey()
              setPhase({ name: 'checking' })
              void start()
            }}
          >
            새로 시작하기 (기존 데이터는 사라집니다)
          </button>
        </div>
      </main>
    )
  }

  /* ---------- 저장소 차단 ---------- */
  if (phase.name === 'blocked') {
    return (
      <main className="gate">
        <div className="gate-card">
          <h1>저장소를 쓸 수 없습니다</h1>
          <p className="gate-sub">
            이 브라우저가 저장소를 막고 있어 계정 키를 보관할 수 없습니다.
            사생활 보호 모드라면 일반 창에서 열어 주세요.
          </p>
          <button className="action-btn" onClick={() => void start()}>
            다시 시도
          </button>
        </div>
      </main>
    )
  }

  /* ---------- 오류 ---------- */
  if (phase.name === 'error') {
    return (
      <main className="gate">
        <div className="gate-card">
          <h1>연결하지 못했습니다</h1>
          <p className="gate-sub">{phase.reason}</p>
          <button className="action-btn" onClick={() => void start()}>
            다시 시도
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="gate">
      <div className="gate-card">
        <p className="gate-sub">준비 중…</p>
      </div>
    </main>
  )
}
