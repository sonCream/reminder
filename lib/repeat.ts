/**
 * 반복 규칙 처리.
 *
 * 시각은 전부 UTC 로 다룬다. 한국은 서머타임이 없는 고정 +9 시간대라
 * UTC 로 하루/한 달을 더해도 현지 시각(09:00 등)이 그대로 유지된다.
 * 다른 시간대 사용자를 받게 되면 사용자별 오프셋을 따로 저장해야 한다.
 */

/// 요일 판정은 현지 기준이어야 한다.
/// 07:00 KST 는 UTC 로 전날 22:00 이라, UTC 요일을 그대로 쓰면 하루가 어긋난다.
const TZ_OFFSET_MIN = 540 // KST +09:00

export type RepeatRule = 'daily' | 'weekday' | 'weekly' | 'monthly' | 'yearly'

export const REPEAT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '안 함' },
  { value: 'daily', label: '매일' },
  { value: 'weekday', label: '평일만 (월~금)' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
]

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/// 예전에 화면 표시용 한글이 그대로 저장된 데이터가 있다. 그것도 받아준다.
const LEGACY: Record<string, RepeatRule> = {
  매일: 'daily',
  평일만: 'weekday',
  매주: 'weekly',
  매월: 'monthly',
  매년: 'yearly',
}

export function normalizeRule(raw: string | null | undefined): RepeatRule | null {
  if (!raw) return null
  if (raw === 'daily' || raw === 'weekday' || raw === 'weekly' || raw === 'monthly' || raw === 'yearly') {
    return raw
  }
  return LEGACY[raw] ?? null
}

/// 목록에 보여줄 문장. "매주 월요일", "매월 15일" 처럼 기준 시각을 함께 읽어준다.
export function repeatLabel(raw: string | null | undefined, at?: Date | null): string | null {
  const rule = normalizeRule(raw)
  if (!rule) return null
  if (!at) {
    return REPEAT_OPTIONS.find((o) => o.value === rule)?.label ?? null
  }

  const local = toLocal(at)
  switch (rule) {
    case 'daily': return '매일'
    case 'weekday': return '평일만'
    case 'weekly': return `매주 ${DAY_KO[local.getUTCDay()]}요일`
    case 'monthly': return `매월 ${local.getUTCDate()}일`
    case 'yearly': return `매년 ${local.getUTCMonth() + 1}월 ${local.getUTCDate()}일`
  }
}

/* ------------------------------------------------------------------ */

/// UTC 시각을 "현지 시각을 UTC 필드에 담은" 형태로 옮긴다. 요일·날짜 판정용.
function toLocal(d: Date): Date {
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60_000)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

/// 말일 처리: 1월 31일에 한 달을 더하면 2월 28일(윤년이면 29일)이 된다.
function addMonths(d: Date, n: number): Date {
  const local = toLocal(d)
  const day = local.getUTCDate()

  const moved = new Date(local.getTime())
  moved.setUTCDate(1)
  moved.setUTCMonth(moved.getUTCMonth() + n)

  const lastDay = new Date(Date.UTC(moved.getUTCFullYear(), moved.getUTCMonth() + 1, 0)).getUTCDate()
  moved.setUTCDate(Math.min(day, lastDay))

  return new Date(moved.getTime() - TZ_OFFSET_MIN * 60_000)
}

/// 규칙에 따라 한 회차 뒤로 옮긴다.
function step(d: Date, rule: RepeatRule): Date {
  switch (rule) {
    case 'daily':
      return addDays(d, 1)
    case 'weekday': {
      let next = addDays(d, 1)
      // 토(6)·일(0)은 건너뛴다.
      while ([0, 6].includes(toLocal(next).getUTCDay())) next = addDays(next, 1)
      return next
    }
    case 'weekly':
      return addDays(d, 7)
    case 'monthly':
      return addMonths(d, 1)
    case 'yearly':
      return addMonths(d, 12)
  }
}

/**
 * `after` 보다 뒤에 오는 다음 회차를 구한다.
 *
 * 며칠 자리를 비운 사이 여러 회차가 지나갔을 수 있다. 그때 밀린 것을 전부 보내면
 * "약 먹기" 알림이 한꺼번에 30개 쏟아진다. 그래서 지나간 회차는 건너뛰고
 * 앞으로 올 첫 회차 하나만 잡는다.
 *
 * `endAt` 을 넘어서면 null 을 돌려준다 — 반복이 끝났다는 뜻이다.
 */
export function nextOccurrence(
  from: Date,
  rawRule: string | null | undefined,
  after: Date = new Date(),
  endAt?: Date | null,
): Date | null {
  const rule = normalizeRule(rawRule)
  if (!rule) return null

  let next = step(from, rule)
  // 잘못된 규칙으로 무한 반복에 빠지지 않도록 상한을 둔다.
  for (let i = 0; i < 1000 && next.getTime() <= after.getTime(); i += 1) {
    next = step(next, rule)
  }

  if (next.getTime() <= after.getTime()) return null
  if (endAt && next.getTime() > endAt.getTime()) return null
  return next
}
