'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

/// 드러나는 버튼 두 개의 총 너비.
const ACTIONS_WIDTH = 160
/// 이만큼 움직여야 방향(가로/세로)을 판정한다.
const DECIDE_PX = 10
/// 왼쪽 가장자리에서 시작한 터치는 무시한다. iOS의 '뒤로 가기' 제스처와 겹치기 때문.
const EDGE_GUARD = 24

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClone: () => void
  onDelete: () => void
  disabled?: boolean
  children: ReactNode
}

/**
 * 좌로 밀면 복제·삭제 버튼이 나오는 행.
 *
 * 세로 스크롤과 싸우지 않도록 처음 10px 움직임으로 방향을 먼저 판정하고,
 * 가로로 판정된 경우에만 행을 끌고 간다. `touch-action: pan-y` 가 세로 스크롤을
 * 브라우저에 그대로 넘겨주므로 목록 스크롤은 평소와 똑같이 동작한다.
 */
export function SwipeRow({ open, onOpenChange, onClone, onDelete, disabled, children }: Props) {
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  /// 마지막 이동량을 ref 로도 들고 있는다.
  /// finish() 가 state 를 읽으면 React 배치 때문에 이전 값이 잡혀,
  /// 빠르게 밀었을 때 열림 판정이 어긋난다.
  const current = useRef(0)

  const offset = drag ?? (open ? -ACTIONS_WIDTH : 0)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || e.clientX < EDGE_GUARD) return
    start.current = { x: e.clientX, y: e.clientY, base: open ? -ACTIONS_WIDTH : 0 }
    axis.current = 'none'
    current.current = open ? -ACTIONS_WIDTH : 0
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s) return

    const dx = e.clientX - s.x
    const dy = e.clientY - s.y

    if (axis.current === 'none') {
      if (Math.abs(dy) > DECIDE_PX && Math.abs(dy) > Math.abs(dx)) {
        // 세로로 판정됐다. 스크롤이므로 손을 뗀다.
        start.current = null
        axis.current = 'y'
        return
      }
      if (Math.abs(dx) > DECIDE_PX) {
        axis.current = 'x'
        e.currentTarget.setPointerCapture(e.pointerId)
      } else {
        return
      }
    }

    const next = Math.max(-ACTIONS_WIDTH, Math.min(0, s.base + dx))
    current.current = next
    setDrag(next)
  }

  function finish() {
    if (axis.current === 'x') onOpenChange(current.current < -ACTIONS_WIDTH / 2)
    start.current = null
    axis.current = 'none'
    setDrag(null)
  }

  return (
    <div className="swipe">
      <div className="swipe-actions" aria-hidden={!open}>
        <button
          className="swipe-btn clone"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            onOpenChange(false)
            onClone()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          복제
        </button>
        <button
          className="swipe-btn del"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            onOpenChange(false)
            onDelete()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          </svg>
          삭제
        </button>
      </div>

      <div
        className={`swipe-content${drag !== null ? ' dragging' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {children}
        {/* 열린 상태에서는 본문을 눌러도 동작하지 않고 닫히기만 한다. */}
        {open && (
          <button className="swipe-shield" aria-label="닫기" onClick={() => onOpenChange(false)} />
        )}
      </div>
    </div>
  )
}
