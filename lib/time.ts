/**
 * 시각 표시 도우미.
 *
 * DB는 UTC만 다루고, 사람이 읽는 형태로 바꾸는 일은 전부 여기서 한다.
 * 브라우저의 Date는 자동으로 기기 시간대(한국이면 KST)로 표시되므로 별도 변환이 필요 없다.
 */

export const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export type Bucket = 'late' | 'today' | 'tomorrow' | 'week' | 'future'

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000)
}

/// "09:25" · "내일 09:05" · "8/15 (토) 08:00"
export function timeLabel(d: Date, now: Date): string {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const diff = dayDiff(d, now)
  if (diff === 0) return hm
  if (diff === 1) return `내일 ${hm}`
  if (diff === -1) return `어제 ${hm}`
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_KO[d.getDay()]}) ${hm}`
}

/// "(2분)" · "(23시간)" · "(3일)" · "(12시간 지남)"
export function relLabel(d: Date, now: Date): string {
  const ms = d.getTime() - now.getTime()
  const past = ms < 0
  const minutes = Math.round(Math.abs(ms) / 60_000)

  let text: string
  if (minutes < 1) text = '곧'
  else if (minutes < 60) text = `${minutes}분`
  else if (minutes < 1440) text = `${Math.round(minutes / 60)}시간`
  else text = `${Math.round(minutes / 1440)}일`

  return past ? `(${text} 지남)` : `(${text})`
}

export function bucketOf(d: Date, now: Date): Bucket {
  if (d.getTime() < now.getTime()) return 'late'
  const diff = dayDiff(d, now)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 7) return 'week'
  return 'future'
}

export function bucketTitle(bucket: Bucket, now: Date): string {
  const day = (offset: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`
  }
  switch (bucket) {
    case 'late': return '지난 알림'
    case 'today': return `오늘 · ${day(0)}`
    case 'tomorrow': return `내일 · ${day(1)}`
    case 'week': return '앞으로 7일'
    case 'future': return '이후'
  }
}

export const BUCKET_ORDER: Bucket[] = ['late', 'today', 'tomorrow', 'week', 'future']

/// <input type="datetime-local"> 이 요구하는 형식. 반드시 로컬 시각이어야 한다.
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): Date {
  return new Date(value)
}
