'use client'

import { useEffect, useState } from 'react'
import type { ReminderDTO } from '@/lib/types'
import { fromLocalInput, relLabel, timeLabel, toLocalInput } from '@/lib/time'
import { REPEAT_OPTIONS, normalizeRule } from '@/lib/repeat'

export interface EditPayload {
  title: string
  remindAt: string
  memo: string | null
  repeatRule: string | null
  repeatEndAt: string | null
  leadMinutes: number | null
  snoozeMinutes: number
}

interface Props {
  /// null이면 새로 만드는 중.
  reminder: ReminderDTO | null
  open: boolean
  busy: boolean
  onCancel: () => void
  onSave: (payload: EditPayload) => void
  onDelete: () => void
}

const HOUR_PRESETS = [7, 12, 17, 21]
const SHIFTS: [string, number][] = [
  ['+3시간', 180],
  ['+1일', 1440],
  ['+1주', 10080],
]
const LEADS: [string, number | null][] = [
  ['없음', null],
  ['5분 전', 5],
  ['30분 전', 30],
  ['1시간 전', 60],
  ['1일 전', 1440],
]
const SNOOZES = [5, 15, 30, 60]

export function EditScreen({ reminder, open, busy, onCancel, onSave, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [memo, setMemo] = useState('')
  const [repeatRule, setRepeatRule] = useState('')
  const [repeatEndAt, setRepeatEndAt] = useState('')
  const [leadMinutes, setLeadMinutes] = useState<number | null>(null)
  const [snoozeMinutes, setSnoozeMinutes] = useState(15)

  // 화면이 열릴 때마다 대상 리마인더의 값으로 채운다.
  useEffect(() => {
    const base = reminder ? new Date(reminder.remindAt) : new Date(Date.now() + 60 * 60_000)
    setTitle(reminder?.title ?? '')
    setWhen(toLocalInput(base))
    setMemo(reminder?.memo ?? '')
    // 예전에 한글로 저장된 값도 코드로 바꿔 받아준다.
    setRepeatRule(normalizeRule(reminder?.repeatRule) ?? '')
    setRepeatEndAt(reminder?.repeatEndAt ? reminder.repeatEndAt.slice(0, 10) : '')
    setLeadMinutes(reminder?.leadMinutes ?? null)
    setSnoozeMinutes(reminder?.snoozeMinutes ?? 15)
  }, [reminder])

  const parsed = when ? fromLocalInput(when) : null
  const valid = title.trim() !== '' && parsed !== null && !Number.isNaN(parsed.getTime())
  const now = new Date()

  function shift(minutes: number) {
    const base = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date()
    setWhen(toLocalInput(new Date(base.getTime() + minutes * 60_000)))
  }

  function setHour(hour: number) {
    const base = parsed && !Number.isNaN(parsed.getTime()) ? new Date(parsed) : new Date()
    base.setHours(hour, 0, 0, 0)
    setWhen(toLocalInput(base))
  }

  return (
    <section className={`screen screen-edit${open ? ' on' : ''}`} aria-label="리마인더 편집">
      <div className="edit-head">
        <button className="txt-btn" onClick={onCancel} disabled={busy}>취소</button>
        <h2>{reminder ? '리마인더' : '새 리마인더'}</h2>
        <button
          className="txt-btn primary"
          disabled={!valid || busy}
          onClick={() =>
            onSave({
              title: title.trim(),
              remindAt: parsed!.toISOString(),
              memo: memo.trim() === '' ? null : memo.trim(),
              repeatRule: repeatRule === '' ? null : repeatRule,
              // 종료일은 그날 끝까지 포함되도록 23:59 로 둔다.
              repeatEndAt:
                repeatRule !== '' && repeatEndAt !== ''
                  ? new Date(`${repeatEndAt}T23:59`).toISOString()
                  : null,
              leadMinutes,
              snoozeMinutes,
            })
          }
        >
          저장
        </button>
      </div>

      <div className="scroll" style={{ gap: '1.125rem' }}>
        <div className="grp">
          <div className="fld">
            <input
              type="text"
              value={title}
              placeholder="제목"
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={!reminder}
            />
          </div>
        </div>

        <div className="grp">
          <p className="lbl">알림 시각</p>
          <div className="fld">
            <div className="fld-row">
              <span className="fld-name">알람</span>
              <span className={`fld-val${parsed && parsed < now ? ' warn' : ''}`}>
                {parsed && !Number.isNaN(parsed.getTime())
                  ? `${timeLabel(parsed, now)} ${relLabel(parsed, now)}`
                  : '—'}
              </span>
            </div>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          <div className="presets" aria-label="자주 쓰는 시각">
            {HOUR_PRESETS.map((h) => (
              <button key={h} onClick={() => setHour(h)}>
                {String(h).padStart(2, '0')}:00
              </button>
            ))}
          </div>

          <div className="presets" aria-label="빠른 이동">
            <button className="word" onClick={() => setWhen(toLocalInput(new Date()))}>지금</button>
            {SHIFTS.map(([label, m]) => (
              <button key={label} className="word" onClick={() => shift(m)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="grp">
          <p className="lbl">반복</p>
          <div className="fld">
            <div className="fld-row">
              <span className="fld-name">반복</span>
              <select value={repeatRule} onChange={(e) => setRepeatRule(e.target.value)}>
                {REPEAT_OPTIONS.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {repeatRule !== '' && (
              <div className="fld-row">
                <span className="fld-name">반복 종료</span>
                <input
                  type="date"
                  className="date-inline"
                  value={repeatEndAt}
                  onChange={(e) => setRepeatEndAt(e.target.value)}
                />
              </div>
            )}
          </div>
          {repeatRule !== '' && (
            <p className="hint">
              알림을 보내거나 완료로 표시하면 다음 회차가 자동으로 잡힙니다.
              {repeatEndAt === '' ? ' 종료일을 비워두면 계속 반복합니다.' : ''}
            </p>
          )}
        </div>

        <div className="grp">
          <p className="lbl">알림</p>
          <div className="fld">
            <div className="fld-row">
              <span className="fld-name">미리 알림</span>
              <select
                value={leadMinutes ?? ''}
                onChange={(e) => setLeadMinutes(e.target.value === '' ? null : Number(e.target.value))}
              >
                {LEADS.map(([label, v]) => (
                  <option key={label} value={v ?? ''}>{label}</option>
                ))}
              </select>
            </div>
            <div className="fld-row">
              <span className="fld-name">다시 알림 간격</span>
              <select value={snoozeMinutes} onChange={(e) => setSnoozeMinutes(Number(e.target.value))}>
                {SNOOZES.map((m) => (
                  <option key={m} value={m}>{m}분</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grp">
          <p className="lbl">메모</p>
          <div className="fld">
            <textarea rows={3} value={memo} placeholder="메모" onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>

        {reminder && (
          <button className="del-btn" onClick={onDelete} disabled={busy}>삭제</button>
        )}
      </div>
    </section>
  )
}
