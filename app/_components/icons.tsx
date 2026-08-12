/// 화면에서 쓰는 아이콘 모음. 라이브러리를 받지 않고 필요한 것만 직접 둔다.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
} as const

export function Ring() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function RingCheck() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Repeat() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  )
}

export function Note() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  )
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function Plus() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8} strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Gear() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 005 8.9a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  )
}
