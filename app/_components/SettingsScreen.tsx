'use client'

import { useCallback, useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush } from '@/lib/push-client'

type State = 'ok' | 'warn' | 'off'

function Badge({ state, label }: { state: State; label: string }) {
  return (
    <span className={`state state-${state}`}>
      <span className="dot" />
      {label}
    </span>
  )
}

/**
 * 설정 화면은 꾸미는 곳이 아니라 상태를 확인하는 창구다.
 * 푸시가 안 올 때 원인은 대개 권한·구독·홈 화면 추가 셋 중 하나라 그걸 한눈에 보여주고,
 * 실패하면 "무엇을 하면 되는지"까지 문장으로 알려준다.
 */
export function SettingsScreen() {
  const [permission, setPermission] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [badgeSupported, setBadgeSupported] = useState<boolean | null>(null)
  const [standalone, setStandalone] = useState<boolean | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setPermission(typeof Notification === 'undefined' ? '미지원' : Notification.permission)
    setBadgeSupported('setAppBadge' in navigator)
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    setSubscribed((await currentSubscription()) !== null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    const result = await enablePush()
    setMessage(result.ok ? { ok: true, text: '알림을 켰습니다.' } : { ok: false, text: result.reason })
    await refresh()
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    setMessage(null)
    await disablePush()
    setMessage({ ok: true, text: '알림을 껐습니다.' })
    await refresh()
    setBusy(false)
  }

  async function sendTest() {
    setBusy(true)
    setMessage(null)
    const response = await fetch('/api/push/test', { method: 'POST' })
    const data = await response.json()
    setMessage(
      response.ok
        ? { ok: true, text: '보냈습니다. 잠시 후 알림이 뜨는지 확인해 주세요.' }
        : { ok: false, text: `발송 실패: ${data.error ?? '알 수 없는 오류'}` },
    )
    setBusy(false)
  }

  const permState: State = permission === 'granted' ? 'ok' : permission === 'denied' ? 'warn' : 'off'
  const permLabel =
    permission === null ? '확인 중'
    : permission === 'granted' ? '허용됨'
    : permission === 'denied' ? '차단됨'
    : permission === 'default' ? '미설정'
    : permission

  return (
    <section className="screen" aria-label="설정">
      <div className="bar">
        <h1 className="bar-title">설정</h1>
      </div>

      <div className="scroll">
        <div className="grp">
          <p className="lbl">알림 상태</p>
          <div className="fld">
            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">알림 권한</span>
                <span className="setting-sub">브라우저가 알림을 띄울 수 있는지 여부입니다.</span>
              </div>
              <Badge state={permState} label={permLabel} />
            </div>

            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">푸시 구독</span>
                <span className="setting-sub">서버가 이 기기로 알림을 보낼 수 있는 상태입니다.</span>
              </div>
              <Badge
                state={subscribed ? 'ok' : 'off'}
                label={subscribed === null ? '확인 중' : subscribed ? '정상' : '미연결'}
              />
            </div>

            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">아이콘 배지</span>
                <span className="setting-sub">
                  {badgeSupported === false
                    ? '이 브라우저는 아이콘 숫자 표시를 지원하지 않습니다. 알림은 정상 도착합니다.'
                    : '앱 아이콘에 남은 개수를 숫자로 표시합니다.'}
                </span>
              </div>
              <Badge
                state={badgeSupported ? 'ok' : 'warn'}
                label={badgeSupported === null ? '확인 중' : badgeSupported ? '지원' : '미지원'}
              />
            </div>

            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">홈 화면에 추가됨</span>
                <span className="setting-sub">
                  {standalone
                    ? '앱 모드로 실행 중입니다.'
                    : 'iOS에서는 홈 화면에 추가해야 알림을 받을 수 있습니다.'}
                </span>
              </div>
              <Badge
                state={standalone ? 'ok' : 'off'}
                label={standalone === null ? '확인 중' : standalone ? '완료' : '아직'}
              />
            </div>
          </div>

          {message && <p className={`notice${message.ok ? ' ok' : ''}`}>{message.text}</p>}

          {subscribed ? (
            <>
              <button className="action-btn" onClick={sendTest} disabled={busy}>
                테스트 알림 보내기
              </button>
              <button className="action-btn ghost" onClick={turnOff} disabled={busy}>
                알림 끄기
              </button>
            </>
          ) : (
            <button className="action-btn" onClick={turnOn} disabled={busy}>
              알림 켜기
            </button>
          )}
        </div>

        <div className="grp">
          <p className="lbl">일반</p>
          <div className="fld">
            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">시간대</span>
                <span className="setting-sub">저장은 UTC, 표시는 이 기기 시간대 기준입니다.</span>
              </div>
              <span className="val">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">기본 다시 알림</span>
              </div>
              <span className="val">15분</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
