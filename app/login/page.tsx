'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const ERRORS: Record<string, string> = {
  expired: '링크가 만료됐거나 이미 사용됐습니다. 다시 요청해 주세요.',
  missing: '잘못된 링크입니다. 다시 요청해 주세요.',
}

function LoginForm() {
  const initialError = ERRORS[useSearchParams().get('error') ?? ''] ?? null

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [devLink, setDevLink] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? '요청을 처리하지 못했습니다.')
      } else {
        setSent(true)
        // 개발 중 SMTP 가 없을 때만 내려온다.
        if (data.devLink) setDevLink(data.devLink)
      }
    } catch {
      setError('네트워크 오류입니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="login-card">
        <h1>메일을 확인해 주세요</h1>
        <p className="login-sub">
          <b>{email}</b> 으로 로그인 링크를 보냈습니다.
          <br />
          링크는 15분 뒤 만료됩니다.
        </p>

        {devLink && (
          <div className="login-dev">
            <p>개발 모드 — 메일 설정이 없어 링크를 여기 표시합니다.</p>
            <a href={devLink}>이 링크로 로그인하기</a>
          </div>
        )}

        <button
          className="action-btn ghost"
          onClick={() => {
            setSent(false)
            setDevLink(null)
          }}
        >
          다른 주소로 다시 보내기
        </button>
      </div>
    )
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <h1>리마인더</h1>
      <p className="login-sub">
        이메일 주소를 넣으면 로그인 링크를 보내드립니다.
        <br />
        비밀번호는 없습니다.
      </p>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="이메일 주소"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
      />

      {error && <p className="notice">{error}</p>}

      <button className="action-btn" type="submit" disabled={busy || email.trim() === ''}>
        {busy ? '보내는 중…' : '로그인 링크 받기'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="login">
      <Suspense fallback={<div className="login-card" />}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
