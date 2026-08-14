'use client'

export type Platform = 'android' | 'ios' | 'desktop'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // 아이패드는 최근 iPadOS 에서 데스크톱 UA 를 쓴다. 터치 지원 여부로 걸러낸다.
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  return 'desktop'
}

/// 홈 화면 아이콘으로 실행 중인지. 브라우저 탭에서 열면 false.
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS 는 표준 display-mode 대신 이 값을 쓴다.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}
