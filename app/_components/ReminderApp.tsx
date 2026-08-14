'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReminderDTO } from '@/lib/types'
import {
  BUCKET_ORDER,
  bucketOf,
  bucketTitle,
  relLabel,
  timeLabel,
  type Bucket,
} from '@/lib/time'
import { repeatLabel } from '@/lib/repeat'
import { registerServiceWorker, syncSubscription } from '@/lib/push-client'
import { Onboarding } from './Onboarding'
import { SwipeRow } from './SwipeRow'
import { EditScreen, type EditPayload } from './EditScreen'
import { SettingsScreen } from './SettingsScreen'
import * as I from './icons'

type View = 'active' | 'done'
type Tab = 'list' | 'settings'
/// 편집 대상. 'new'면 새로 만드는 중.
type EditTarget = ReminderDTO | 'new' | null

const QUICK_SHIFTS: [string, number][] = [
  ['−5분', -5],
  ['−1시간', -60],
  ['−1일', -1440],
]
const QUICK_SHIFTS_PLUS: [string, number][] = [
  ['+5분', 5],
  ['+1시간', 60],
  ['+1일', 1440],
]

export function ReminderApp() {
  const [reminders, setReminders] = useState<ReminderDTO[] | null>(null)
  /// 서버 렌더링 시점에는 시각을 계산하지 않는다. 그래야 화면이 어긋나지 않는다.
  const [now, setNow] = useState<Date | null>(null)
  const [view, setView] = useState<View>('active')
  const [tab, setTab] = useState<Tab>('list')
  const [openId, setOpenId] = useState<number | null>(null)
  /// 좌로 밀어 복제·삭제 버튼이 열려 있는 행. 한 번에 하나만 열린다.
  const [swipeId, setSwipeId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Partial<Record<Bucket, boolean>>>({})
  const [editing, setEditing] = useState<EditTarget>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // 서비스 워커는 앱을 열 때마다 등록해 둔다.
  // 이미 알림을 켜둔 기기가 브라우저 업데이트 등으로 워커를 잃었을 때 스스로 복구된다.
  // 이어서 구독을 서버에 다시 등록한다 — 브라우저에만 구독이 남아
  // "화면은 정상인데 알림은 안 오는" 상태에서 스스로 빠져나오게 하는 장치다.
  useEffect(() => {
    void (async () => {
      await registerServiceWorker()
      await syncSubscription()
    })()
  }, [])

  const load = useCallback(async (which: View) => {
    const res = await fetch(`/api/reminders?done=${which === 'done' ? 1 : 0}`, { cache: 'no-store' })
    const data = await res.json()
    setReminders(data.reminders as ReminderDTO[])
  }, [])

  useEffect(() => {
    void load(view)
  }, [view, load])

  // 알림의 버튼(완료 / 나중에)으로 처리하면 서비스 워커가 알려준다.
  // 앱이 열려 있는데 목록이 그대로면 방금 처리한 게 반영되지 않은 것처럼 보인다.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'reminders-changed') void load(view)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [load, view])

  // 앱 아이콘 배지 — 시각이 지났는데 아직 완료하지 않은 개수.
  // 안드로이드 크롬은 이 API가 없으므로 조용히 건너뛴다.
  useEffect(() => {
    if (!reminders || view !== 'active' || !('setAppBadge' in navigator)) return
    const overdue = reminders.filter((r) => new Date(r.remindAt) <= new Date()).length
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    void (overdue > 0 ? nav.setAppBadge?.(overdue) : nav.clearAppBadge?.())
  }, [reminders, view])

  async function mutate(run: () => Promise<Response>) {
    if (busy) return
    setBusy(true)
    try {
      await run()
      await load(view)
    } finally {
      setBusy(false)
    }
  }

  const toggleDone = (r: ReminderDTO) =>
    mutate(() =>
      fetch(`/api/reminders/${r.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ done: r.doneAt === null }),
      }),
    )

  const shift = (id: number, minutes: number) =>
    mutate(() =>
      fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shiftMinutes: minutes }),
      }),
    )

  const remove = (id: number) =>
    mutate(() => fetch(`/api/reminders/${id}`, { method: 'DELETE' }))

  /// 같은 내용으로 한 건 더 만든다. 비슷한 리마인더를 만들 때 처음부터 입력하지 않아도 된다.
  const clone = (r: ReminderDTO) =>
    mutate(() =>
      fetch('/api/reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: r.title,
          memo: r.memo,
          remindAt: r.remindAt,
          repeatRule: r.repeatRule,
          leadMinutes: r.leadMinutes,
          snoozeMinutes: r.snoozeMinutes,
        }),
      }),
    )

  function openEdit(target: ReminderDTO | 'new') {
    setOpenId(null)
    setEditing(target)
    requestAnimationFrame(() => requestAnimationFrame(() => setEditOpen(true)))
  }

  function closeEdit() {
    setEditOpen(false)
    setTimeout(() => setEditing(null), 300)
  }

  async function saveEdit(payload: EditPayload) {
    const target = editing
    await mutate(() =>
      target === 'new'
        ? fetch('/api/reminders', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : fetch(`/api/reminders/${(target as ReminderDTO).id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          }),
    )
    if (view !== 'active') setView('active')
    closeEdit()
  }

  async function deleteEditing() {
    if (editing === null || editing === 'new') return
    await remove(editing.id)
    closeEdit()
  }

  const ready = reminders !== null && now !== null

  return (
    <main className="app">
      <div className="screens">
        {/* ---------- 목록 ---------- */}
        <section className="screen" aria-label="리마인더 목록" hidden={tab !== 'list'}>
          <div className="bar">
            <div className="seg-toggle" role="group" aria-label="보기 전환">
              <button aria-pressed={view === 'active'} onClick={() => setView('active')}>진행 중</button>
              <button aria-pressed={view === 'done'} onClick={() => setView('done')}>완료</button>
            </div>
            <button className="icon-btn" aria-label="새 리마인더 추가" onClick={() => openEdit('new')}>
              <I.Plus />
            </button>
          </div>

          <div className="scroll">
            {/* 설치·알림 설정이 끝나면 스스로 사라진다 */}
            {view === 'active' && <Onboarding />}

            {!ready ? (
              <p className="empty">불러오는 중…</p>
            ) : view === 'done' ? (
              <DoneList reminders={reminders} now={now} onToggle={toggleDone} />
            ) : reminders.length === 0 ? (
              <p className="empty">
                예정된 리마인더가 없습니다.
                <br />
                오른쪽 위 ＋ 로 추가해 보세요.
              </p>
            ) : (
              BUCKET_ORDER.map((bucket) => {
                const items = reminders.filter((r) => bucketOf(new Date(r.remindAt), now) === bucket)
                if (items.length === 0) return null
                const isCollapsed = collapsed[bucket] === true

                return (
                  <div
                    key={bucket}
                    className={`section${isCollapsed ? ' collapsed' : ''}${bucket === 'late' ? ' is-late' : ''}`}
                  >
                    <button
                      className="sec-head"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((c) => ({ ...c, [bucket]: !c[bucket] }))}
                    >
                      <I.Chevron className="chev" />
                      <span className="sec-name">{bucketTitle(bucket, now)}</span>
                      <span className="sec-rule" />
                      <span className="sec-n">{items.length}</span>
                    </button>

                    <div className="card">
                      {items.map((r) => (
                        <Row
                          key={r.id}
                          reminder={r}
                          now={now}
                          open={openId === r.id}
                          swipeOpen={swipeId === r.id}
                          busy={busy}
                          onToggle={() => toggleDone(r)}
                          onTap={() => {
                            setSwipeId(null)
                            setOpenId(openId === r.id ? null : r.id)
                          }}
                          onSwipeChange={(v) => {
                            setSwipeId(v ? r.id : null)
                            if (v) setOpenId(null)
                          }}
                          onShift={(m) => shift(r.id, m)}
                          onEdit={() => openEdit(r)}
                          onClone={() => clone(r)}
                          onDelete={() => remove(r.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ---------- 설정 ---------- */}
        {tab === 'settings' && <SettingsScreen />}

        {/* ---------- 편집(오른쪽에서 밀고 들어옴) ---------- */}
        {editing !== null && (
          <EditScreen
            reminder={editing === 'new' ? null : editing}
            open={editOpen}
            busy={busy}
            onCancel={closeEdit}
            onSave={saveEdit}
            onDelete={deleteEditing}
          />
        )}
      </div>

      {editing === null && (
        <nav className="tabbar" role="tablist" aria-label="주요 화면">
          <button className="tab" role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>
            <I.ListIcon />
            목록
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>
            <I.Gear />
            설정
          </button>
        </nav>
      )}
    </main>
  )
}

/* ------------------------------------------------------------------ */

interface RowProps {
  reminder: ReminderDTO
  now: Date
  open: boolean
  swipeOpen: boolean
  busy: boolean
  onToggle: () => void
  onTap: () => void
  onSwipeChange: (open: boolean) => void
  onShift: (minutes: number) => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
}

function Row({
  reminder, now, open, swipeOpen, busy,
  onToggle, onTap, onSwipeChange, onShift, onEdit, onClone, onDelete,
}: RowProps) {
  const at = new Date(reminder.remindAt)
  const done = reminder.doneAt !== null
  const late = !done && at < now
  const soon = !done && !late && at.getTime() - now.getTime() < 3_600_000

  return (
    <>
      <SwipeRow
        open={swipeOpen}
        onOpenChange={onSwipeChange}
        onClone={onClone}
        onDelete={onDelete}
        disabled={busy}
      >
        <div className={`row${done ? ' is-done' : ''}${late ? ' is-late' : ''}${soon ? ' is-soon' : ''}${open ? ' open' : ''}`}>
          <button className="check" aria-label={done ? '완료 해제' : '완료로 표시'} onClick={onToggle} disabled={busy}>
            {done ? <I.RingCheck /> : <I.Ring />}
          </button>

          <button className="row-tap" onClick={onTap}>
            <span className="row-top">
              <span className="row-time">{timeLabel(at, now)}</span>
              <span className="row-rel">{relLabel(at, now)}</span>
            </span>
            <span className="row-title">{reminder.title}</span>
            {(reminder.repeatRule || reminder.memo) && (
              <span className="row-sub">
                {reminder.repeatRule && (
                  <span className="sub-item"><I.Repeat />{repeatLabel(reminder.repeatRule, at)}</span>
                )}
                {reminder.memo && (
                  <span className="sub-item"><I.Note />메모</span>
                )}
              </span>
            )}
          </button>
        </div>
      </SwipeRow>

      {open && (
        <div className="quick">
          {QUICK_SHIFTS.map(([label, m]) => (
            <button key={label} onClick={() => onShift(m)} disabled={busy}>{label}</button>
          ))}
          <button className="word" onClick={onEdit} disabled={busy}>수정</button>

          {QUICK_SHIFTS_PLUS.map(([label, m]) => (
            <button key={label} onClick={() => onShift(m)} disabled={busy}>{label}</button>
          ))}
          <button className="word danger" onClick={onDelete} disabled={busy}>삭제</button>
        </div>
      )}
    </>
  )
}

function DoneList({
  reminders,
  now,
  onToggle,
}: {
  reminders: ReminderDTO[]
  now: Date
  onToggle: (r: ReminderDTO) => void
}) {
  if (reminders.length === 0) return <p className="empty">완료한 리마인더가 없습니다.</p>

  return (
    <div className="section">
      <button className="sec-head" disabled>
        <span className="sec-name">완료</span>
        <span className="sec-rule" />
        <span className="sec-n">{reminders.length}</span>
      </button>
      <div className="card">
        {reminders.map((r) => (
          <div key={r.id} className="row is-done">
            <button className="check" aria-label="완료 해제" onClick={() => onToggle(r)}>
              <I.RingCheck />
            </button>
            <div className="row-tap">
              <span className="row-top">
                <span className="row-time">{timeLabel(new Date(r.remindAt), now)}</span>
              </span>
              <span className="row-title">{r.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
