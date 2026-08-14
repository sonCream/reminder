'use client'

import { useCallback, useEffect, useState } from 'react'
import { detectPlatform, isStandalone, type Platform } from '@/lib/platform'
import { canInstall, promptInstall, subscribeInstall } from '@/lib/install-prompt'
import { patchOnboarding, readOnboarding, subscribeOnboarding } from '@/lib/onboarding'
import { readKey } from '@/lib/auth-client'
import { currentSubscription, enablePush } from '@/lib/push-client'
import { KeyBox } from './KeyBox'

/// iOS 공유 버튼 모양. 말로 "공유 버튼" 이라고 하면 못 찾는 사람이 많다.
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M4 13v6a2 2 0 002 2h12a2 2 0 002-2v-6" />
    </svg>
  )
}

interface Step {
  key: string
  title: string
  desc: string
  done: boolean
  action?: React.ReactNode
}

/**
 * 앱이 스스로 설치·알림 설정을 안내한다.
 *
 * 이게 없으면 링크를 건넬 때마다 "홈 화면에 추가하고, 그 아이콘으로 열고,
 * 설정에서 알림을 켜고…" 를 말로 설명해야 한다. 기종마다 다르기까지 하다.
 * 끝난 항목은 스스로 사라지므로 사용자는 남은 것만 보게 된다.
 */
export function Onboarding({ onDone }: { onDone?: () => void }) {
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [installable, setInstallable] = useState(false)
  const [flags, setFlags] = useState(() => ({ popupAck: false, keyBackedUp: false, hidden: false }))
  const [showKey, setShowKey] = useState(false)
  const [showPopupHelp, setShowPopupHelp] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setPlatform(detectPlatform())
    setStandalone(isStandalone())
    setInstallable(canInstall())
    setFlags(readOnboarding())
    setSubscribed((await currentSubscription()) !== null)
  }, [])

  useEffect(() => {
    void refresh()

    const unsubscribeInstall = subscribeInstall(() => setInstallable(canInstall()))
    // 설정 화면에서 '다시 보기' 를 눌렀을 때 즉시 반응한다.
    const unsubscribeFlags = subscribeOnboarding(setFlags)

    // 홈 화면에 추가하거나 시스템 설정을 만지고 돌아오면 상태가 바뀌어 있다.
    // 돌아왔을 때 다시 확인해야 끝난 항목이 체크로 바뀐다.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      unsubscribeInstall()
      unsubscribeFlags()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  if (platform === null || flags.hidden) return null

  async function install() {
    setBusy(true)
    await promptInstall()
    await refresh()
    setBusy(false)
  }

  async function turnOnNotifications() {
    setBusy(true)
    setError(null)
    const result = await enablePush()
    if (!result.ok) setError(result.reason)
    await refresh()
    setBusy(false)
  }

  function mark(patch: Parameters<typeof patchOnboarding>[0]) {
    setFlags(patchOnboarding(patch))
  }

  /// 팝업 설정은 알림을 길게 눌러 들어가는 게 기종을 안 타는 유일한 방법이다.
  /// 그러려면 길게 누를 알림이 하나 있어야 해서 여기서 바로 보낸다.
  async function sendTestNotification() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/push/test', { method: 'POST' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? '알림을 보내지 못했습니다. 먼저 알림을 켜 주세요.')
      } else {
        setTestSent(true)
      }
    } catch {
      setError('서버에 연결하지 못했습니다.')
    }
    setBusy(false)
  }

  const steps: Step[] = []

  /* ---------- 1. 홈 화면에 추가 ---------- */
  if (platform !== 'desktop') {
    steps.push({
      key: 'install',
      title: '홈 화면에 추가',
      desc:
        platform === 'ios'
          ? '사파리에서 홈 화면에 추가한 앱만 알림을 받을 수 있습니다.'
          : '앱처럼 실행되고, 알림도 이 상태에서만 안정적으로 옵니다.',
      done: standalone,
      action:
        platform === 'android' && installable ? (
          <button className="action-btn" onClick={install} disabled={busy}>
            홈 화면에 추가
          </button>
        ) : (
          <div className="ios-guide">
            {platform === 'ios' ? (
              <p>
                아래쪽 <span className="ios-share"><ShareIcon /></span> 공유 버튼을 누른 뒤
                <b> 홈 화면에 추가</b>를 고르세요.
              </p>
            ) : (
              <p>
                오른쪽 위 <b>⋮</b> 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 고르세요.
              </p>
            )}
          </div>
        ),
    })
  }

  /* ---------- 2. 알림 켜기 ---------- */
  steps.push({
    key: 'notify',
    title: '알림 켜기',
    desc: '정해둔 시각에 알림을 보내려면 필요합니다.',
    done: subscribed,
    action: (
      <>
        <button className="action-btn" onClick={turnOnNotifications} disabled={busy}>
          알림 켜기
        </button>
        {error && <p className="notice">{error}</p>}
        {platform === 'ios' && !standalone && (
          <p className="hint">먼저 홈 화면에 추가한 뒤, 그 아이콘으로 실행해서 눌러 주세요.</p>
        )}
      </>
    ),
  })

  /* ---------- 3. 팝업으로 받기 (안드로이드만) ---------- */
  if (platform === 'android') {
    steps.push({
      key: 'popup',
      title: '팝업으로 받기',
      desc: '안드로이드는 웹 알림을 기본적으로 소리만 나게 합니다. 화면 위에 뜨게 하려면 한 번 설정해야 합니다.',
      done: flags.popupAck,
      action: (
        <>
          <div className="ios-guide">
            <p>
              <b>1.</b> 아래 버튼으로 알림을 하나 받습니다
              <br />
              <b>2.</b> 상단바를 내려 그 알림을 <b>길게 누릅니다</b>
              <br />
              <b>3.</b> 나타나는 <b>톱니바퀴(⚙)</b>를 누릅니다
              <br />
              <b>4.</b> <b>긴급</b> 또는 <b>알림 팝업</b>을 켭니다
            </p>
            <p className="hint">
              기종마다 문구가 다릅니다. <b>팝업</b>·<b>긴급</b>·<b>소리 및 팝업</b> 중 보이는 것을 고르면 됩니다.
            </p>
          </div>

          <button className="action-btn ghost" onClick={sendTestNotification} disabled={busy}>
            {testSent ? '다시 보내기' : '테스트 알림 보내기'}
          </button>

          {showPopupHelp ? (
            <div className="ios-guide">
              <p className="hint">
                알림을 길게 눌러도 톱니바퀴가 없다면 설정에서 찾습니다.
                <br />
                경로는 기종마다 다르니 <b>설정 검색창에 &lsquo;리마인더&rsquo;</b>를 입력하는 편이 빠릅니다.
              </p>
              <p className="path">설정 → 앱 → 리마인더 → 알림 → (채널 선택) → 팝업 켜기</p>
              <p className="hint">⚠️ 채널(보통 <b>일반</b>)을 한 번 더 눌러야 팝업 설정이 나옵니다.</p>
            </div>
          ) : (
            <button className="action-btn ghost" onClick={() => setShowPopupHelp(true)}>
              톱니바퀴가 안 보이면
            </button>
          )}

          <button className="action-btn" onClick={() => mark({ popupAck: true })}>
            했어요
          </button>
        </>
      ),
    })
  }

  /* ---------- 4. 계정 키 보관 ---------- */
  steps.push({
    key: 'backup',
    title: '계정 키 보관',
    desc: '이 앱은 가입이 없습니다. 키가 계정을 대신하고, 잃으면 되찾을 수 없습니다.',
    done: flags.keyBackedUp,
    action: showKey ? (
      <>
        <KeyBox value={readKey() ?? ''} />
        <button
          className="action-btn"
          onClick={() => {
            mark({ keyBackedUp: true })
            setShowKey(false)
          }}
        >
          보관했어요
        </button>
      </>
    ) : (
      <button className="action-btn ghost" onClick={() => setShowKey(true)}>
        키 보기
      </button>
    ),
  })

  const remaining = steps.filter((s) => !s.done)
  if (remaining.length === 0) {
    onDone?.()
    return null
  }

  return (
    <section className="onboard" aria-label="시작하기">
      <div className="onboard-head">
        <h2>시작하기</h2>
        <span className="onboard-count">
          {steps.length - remaining.length} / {steps.length}
        </span>
        <button className="gate-link" onClick={() => mark({ hidden: true })}>
          접기
        </button>
      </div>

      <ol className="onboard-steps">
        {steps.map((step, index) => (
          <li key={step.key} className={step.done ? 'done' : ''}>
            <span className="mark" aria-hidden="true">
              {step.done ? '✓' : index + 1}
            </span>
            <div className="body">
              <span className="title">{step.title}</span>
              <span className="desc">{step.desc}</span>
              {!step.done && step.action}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
