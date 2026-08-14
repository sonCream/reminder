'use client'

/**
 * 온보딩 진행 상태.
 *
 * 설치 여부나 알림 권한은 브라우저에 물어보면 알 수 있지만,
 * "안드로이드 팝업 설정을 켰는지" 와 "키를 백업했는지" 는 확인할 방법이 없다.
 * 그 둘만 사용자가 눌러 표시하는 값으로 남긴다.
 */

const STORAGE = 'reminder.onboarding'

export interface OnboardingState {
  /// 안드로이드 알림 팝업 설정을 확인했다고 사용자가 표시함
  popupAck: boolean
  /// 계정 키를 보관했다고 사용자가 표시함
  keyBackedUp: boolean
  /// 전부 끝나지 않았어도 접어둠
  hidden: boolean
}

const DEFAULTS: OnboardingState = { popupAck: false, keyBackedUp: false, hidden: false }

export function readOnboarding(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(STORAGE)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<OnboardingState>) }
  } catch {
    return DEFAULTS
  }
}

/// 설정 화면에서 상태를 바꿔도 목록 위의 안내가 즉시 반응해야 한다.
/// 저장만 하면 이미 떠 있는 화면은 예전 값을 그대로 들고 있다.
const listeners = new Set<(state: OnboardingState) => void>()

export function subscribeOnboarding(fn: (state: OnboardingState) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/// 안내를 처음 상태로 되돌린다.
///
/// 안드로이드는 홈 화면에서 앱을 지워도 사이트 데이터가 남아 예전 진행 상태를
/// 그대로 물려받는다. 다시 설치했는데 이미 다 끝난 것처럼 보이는 이유다.
export function resetOnboarding(): OnboardingState {
  return patchOnboarding({ popupAck: false, keyBackedUp: false, hidden: false })
}

export function patchOnboarding(patch: Partial<OnboardingState>): OnboardingState {
  const next = { ...readOnboarding(), ...patch }
  try {
    window.localStorage.setItem(STORAGE, JSON.stringify(next))
  } catch {
    /* 저장하지 못해도 이번 화면에서는 반영된다 */
  }
  listeners.forEach((fn) => fn(next))
  return next
}
