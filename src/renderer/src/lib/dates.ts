import type { DayKey } from '@shared/todo'

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

export function formatDay(key: DayKey, locale?: string): string {
  return fromDayKey(key).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function relativeLabel(key: DayKey, today: DayKey): string | null {
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  return null
}
