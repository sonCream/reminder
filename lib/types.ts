import type { Reminder } from '@prisma/client'

/// 화면으로 넘기는 형태. Date는 JSON으로 못 넘기므로 ISO 문자열로 바꾼다.
export interface ReminderDTO {
  id: number
  title: string
  memo: string | null
  remindAt: string
  repeatRule: string | null
  leadMinutes: number | null
  snoozeMinutes: number
  autoComplete: boolean
  doneAt: string | null
}

export function toDTO(r: Reminder): ReminderDTO {
  return {
    id: r.id,
    title: r.title,
    memo: r.memo,
    remindAt: r.remindAt.toISOString(),
    repeatRule: r.repeatRule,
    leadMinutes: r.leadMinutes,
    snoozeMinutes: r.snoozeMinutes,
    autoComplete: r.autoComplete,
    doneAt: r.doneAt ? r.doneAt.toISOString() : null,
  }
}
