import type { DayKey } from './todo'

const pad = (n: number): string => String(n).padStart(2, '0')

export function toDayKey(date: Date): DayKey {
  return `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DayKey
}

export function fromDayKey(key: DayKey): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
}

export function addDays(key: DayKey, amount: number): DayKey {
  const date = fromDayKey(key)
  // setDate (rather than adding 24h) stays correct across daylight-saving changes.
  date.setDate(date.getDate() + amount)
  return toDayKey(date)
}

/** The day's place on a continuous number line: consecutive days are 1 apart, also across daylight-saving changes. */
export function dayIndex(key: DayKey): number {
  const date = fromDayKey(key)
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/** The year is only said where it is not today's: the deck can travel past New Year. */
const yearOf = (key: DayKey, today: DayKey): 'numeric' | undefined =>
  key.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric'

/** The whole date, weekday first: "Saturday, September 19". */
export function formatDay(key: DayKey, today: DayKey, locale?: string): string {
  return fromDayKey(key).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: yearOf(key, today)
  })
}

/** The date without its weekday: "September 19". */
export function formatDate(key: DayKey, today: DayKey, locale?: string): string {
  return fromDayKey(key).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: yearOf(key, today)
  })
}

export function formatWeekday(key: DayKey, locale?: string): string {
  return fromDayKey(key).toLocaleDateString(locale, { weekday: 'short' })
}

export function formatLongWeekday(key: DayKey, locale?: string): string {
  return fromDayKey(key).toLocaleDateString(locale, { weekday: 'long' })
}

/** How far the day is from today, in days: "in 4 days", "3 days ago". */
export function formatDistance(key: DayKey, today: DayKey, locale?: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(
    dayIndex(key) - dayIndex(today),
    'day'
  )
}

export function relativeLabel(key: DayKey, today: DayKey): string | null {
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  return null
}
