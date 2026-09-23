import type { DayKey } from '@/domain/todo'
import {
  addDays,
  compareDays,
  formatDate,
  formatDay,
  formatDistance,
  formatLongWeekday,
  relativeLabel
} from '@/domain/dates'

/*
 * The words on a card. They say where the day stands and nothing about how it went: an empty day or
 * an unfinished one gets no comment. The wording stays the same from day to day and only the part
 * that differs changes (docs/design.md §10).
 */

/** The card's title is what the day is called out loud: "Today", "Yesterday", "Tomorrow", otherwise its weekday. */
export function dayTitle(day: DayKey, today: DayKey, locale?: string): string {
  return relativeLabel(day, today) ?? formatLongWeekday(day, locale)
}

/**
 * The line under the title says what the title leaves out. Under a name like "Today" that is the
 * whole date; under a weekday it is the rest of the date and how far from today the day is.
 */
export function dayDetail(day: DayKey, today: DayKey, locale?: string): string {
  if (relativeLabel(day, today) !== null) return formatDay(day, today, locale)
  return `${formatDate(day, today, locale)} · ${formatDistance(day, today, locale)}`
}

/** Shown in place of the list on a day without todos. It has no tense, so it reads the same for any day. */
export function emptyDayLine(day: DayKey, today: DayKey): string {
  const label = relativeLabel(day, today)
  return `Nothing planned for ${label === null ? 'this day' : label.toLowerCase()}.`
}

/** Added to the header line once nothing on the day is left open. */
export const CLEARED_LABEL = 'Cleared'

/** Which way the deck flips to reach a day: `next` is the day after, like the right arrow. */
export type MoveDirection = 'next' | 'previous'

export interface MoveTarget {
  readonly day: DayKey
  /** What the day is called on the move word. */
  readonly name: 'tomorrow' | 'today'
  readonly direction: MoveDirection
}

/** Where a moved todo goes: tomorrow from today, today from any other day. The arrow on the word follows the direction. */
export function moveTarget(day: DayKey, today: DayKey): MoveTarget {
  if (day === today) return { day: addDays(today, 1), name: 'tomorrow', direction: 'next' }
  return { day: today, name: 'today', direction: compareDays(day, today) < 0 ? 'next' : 'previous' }
}
