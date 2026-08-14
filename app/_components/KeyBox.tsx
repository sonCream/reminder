'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * 계정 키를 보여준다.
 *
 * ⚠️ 이 값은 비밀번호와 같다. 가진 사람이 곧 그 계정이다.
 *    그래서 기본으로 펼쳐두지 않고, 누른 뒤에만 드러나게 한다.
 *    카페에서 어깨너머로 찍히는 것만으로 계정이 넘어간다.
 */
export function KeyBox({ value }: { value: string }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    // QR 은 다른 기기로 옮길 때 쓴다. 43자를 손으로 옮겨 적는 것보다 훨씬 빠르다.
    QRCode.toDataURL(value, { margin: 1, width: 320 })
      .then((url) => {
        if (alive) setQr(url)
      })
      .catch(() => setQr(null))
    return () => {
      alive = false
    }
  }, [value])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드가 막힌 환경에서는 위의 문자열을 직접 선택해서 복사하면 된다.
    }
  }

  return (
    <div className="keybox">
      <p className="warn">
        이 키가 곧 계정입니다. 다른 사람에게 보이지 마세요.
        <br />
        잃어버리면 되찾을 방법이 없습니다.
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="계정 키 QR 코드" />}

      <code>{value}</code>

      <button className="action-btn ghost" onClick={copy}>
        {copied ? '복사했습니다' : '키 복사하기'}
      </button>
    </div>
  )
}
