'use client'

import { useCallback, useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush } from '@/lib/push-client'
import { clearKey, rotateKey } from '@/lib/auth-client'
import { KeyBox } from './KeyBox'

type State = 'ok' | 'warn' | 'off'
type Platform = 'android' | 'ios' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // 아이패드는 최근 iPadOS 에서 데스크톱 UA 를 쓴다. 터치 지원 여부로 걸러낸다.
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  return 'desktop'
}

/**
 * 기기별 알림 설정 안내.
 *
 * 알림이 안 오거나 팝업으로 안 뜨는 원인은 대부분 앱이 아니라 기기 설정에 있는데,
 * 그 경로가 기종마다 다르고 한 단계 더 들어가 있어 찾기 어렵다.
 * 접속한 기기에 해당하는 것만 보여준다.
 */
function PlatformHelp({ platform }: { platform: Platform }) {
  if (platform === 'android') {
    return (
      <div className="help">
        <section>
          <h4>알림은 오는데 화면에 팝업으로 안 뜰 때</h4>
          <p>안드로이드는 웹 알림을 기본적으로 &lsquo;소리만&rsquo; 등급으로 만듭니다. 팝업은 직접 켜야 합니다.</p>
          <p className="path">설정 → 앱 → 리마인더 → 알림 → <b>일반</b> → 알림 팝업 켜기</p>
          <p className="tip">⚠️ <b>일반</b>을 한 번 더 눌러야 팝업 설정이 나옵니다. 앱 알림 화면에서는 안 보입니다.</p>
          <p className="tip">갤럭시에서 팝업이 밋밋하면 설정 → 알림 → 알림 팝업 스타일을 &lsquo;자세히&rsquo;로 바꿔보세요.</p>
        </section>
        <section>
          <h4>알림이 아예 안 올 때</h4>
          <p>절전 기능이 앱을 종료하면 백그라운드 알림을 막습니다.</p>
          <p className="path">설정 → 앱 → 리마인더 → 배터리 → <b>제한 없음</b></p>
        </section>
        <section>
          <h4>아이콘 숫자에 대해</h4>
          <p className="tip">
            안드로이드 브라우저는 앱이 숫자를 지정하는 기능을 지원하지 않습니다.
            아이콘에 보이는 숫자는 읽지 않은 알림 개수를 런처가 센 값입니다.
          </p>
        </section>
      </div>
    )
  }

  if (platform === 'ios') {
    return (
      <div className="help">
        <section>
          <h4>홈 화면에 추가해야 알림을 받습니다</h4>
          <p>사파리 탭에서는 알림을 켤 수 없습니다. 공유 → 홈 화면에 추가한 뒤, 그 아이콘으로 실행해 주세요.</p>
        </section>
        <section>
          <h4>iOS에서 안 되는 것</h4>
          <p className="tip">
            알림의 버튼(완료 · 나중에)과 알림음 지정은 iOS가 웹 알림에 대해 지원하지 않습니다.
            알림을 누르면 앱이 열립니다.
          </p>
        </section>
        <section>
          <h4>알림이 안 올 때</h4>
          <p className="path">설정 → 알림 → 리마인더 → 알림 허용 확인</p>
          <p className="tip">집중 모드가 켜져 있으면 알림이 지연되거나 묶일 수 있습니다.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="help">
      <section>
        <h4>알림이 안 올 때</h4>
        <p>주소창의 자물쇠 아이콘에서 이 사이트의 알림이 허용돼 있는지 확인해 주세요.</p>
        <p className="tip">브라우저를 완전히 종료하면 알림이 오지 않습니다. 창을 닫아도 백그라운드에서 실행 중이어야 합니다.</p>
      </section>
      <section>
        <h4>폰에서 쓰시려면</h4>
        <p className="tip">같은 주소로 접속한 뒤 홈 화면에 추가하면 앱처럼 쓸 수 있습니다.</p>
      </section>
    </div>
  )
}

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
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [devices, setDevices] = useState<number | null>(null)
  /// 키는 서버에 해시만 있어서 다시 가져올 수 없다.
  /// 이 기기에 저장된 값을 그대로 보여주거나, 새로 발급받았을 때만 채워진다.
  const [shownKey, setShownKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setPermission(typeof Notification === 'undefined' ? '미지원' : Notification.permission)
    setBadgeSupported('setAppBadge' in navigator)
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    setPlatform(detectPlatform())
    setSubscribed((await currentSubscription()) !== null)

    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await response.json()
      setDevices(data.user?.devices ?? null)
    } catch {
      setDevices(null)
    }
  }, [])

  async function makeNewKey() {
    if (!window.confirm('키를 새로 만들면 예전 키는 쓸 수 없게 되고, 다른 기기의 연결도 끊깁니다. 계속할까요?')) {
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await rotateKey()
    setBusy(false)

    if (!result.ok) {
      setMessage({ ok: false, text: result.reason ?? '키를 새로 만들지 못했습니다.' })
      return
    }
    setShownKey(result.key ?? null)
    setMessage({ ok: true, text: '새 키를 만들었습니다. 아래 값을 다시 보관해 주세요.' })
    await refresh()
  }

  async function disconnect() {
    if (!window.confirm('이 기기에서 계정 연결을 끊습니다. 키를 보관해 두지 않았다면 다시 들어올 수 없습니다. 계속할까요?')) {
      return
    }
    setBusy(true)
    // 이 기기의 푸시 구독도 함께 정리한다. 그러지 않으면 연결을 끊어도 알림이 계속 온다.
    await disablePush().catch(() => {})
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    clearKey()
    window.location.reload()
  }

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
          <p className="lbl">계정</p>
          <div className="fld">
            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">가입 없이 사용 중</span>
                <span className="setting-sub">
                  이메일도 비밀번호도 받지 않습니다. 이 기기에 보관된 키가 계정을 대신합니다.
                </span>
              </div>
            </div>
            <div className="setting">
              <div className="setting-body">
                <span className="setting-name">연결된 기기</span>
              </div>
              <span className="val">{devices === null ? '—' : `${devices}대`}</span>
            </div>
          </div>

          {shownKey ? (
            <>
              <KeyBox value={shownKey} />
              <button className="action-btn ghost" onClick={() => setShownKey(null)}>
                가리기
              </button>
            </>
          ) : (
            <button
              className="action-btn ghost"
              onClick={() => setShownKey(localStorage.getItem('reminder.accountKey'))}
            >
              키 보기 · 다른 기기에 추가
            </button>
          )}

          <button className="action-btn ghost" onClick={makeNewKey} disabled={busy}>
            키 새로 만들기
          </button>
          <p className="hint">
            키가 다른 사람에게 노출됐을 때 씁니다. 예전 키는 즉시 무효가 되고 다른 기기의 연결도 끊깁니다.
          </p>

          <button className="del-btn" onClick={disconnect} disabled={busy}>
            이 기기에서 연결 끊기
          </button>
        </div>

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
          <p className="lbl">알림이 안 뜬다면</p>
          <button className="action-btn ghost" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen}>
            {helpOpen ? '닫기' : '이 기기에서 확인할 것 보기'}
          </button>
          {helpOpen && platform && <PlatformHelp platform={platform} />}
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
