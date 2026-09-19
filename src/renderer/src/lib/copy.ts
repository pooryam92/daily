import type { DayKey } from '@shared/todo'
import { relativeLabel } from './dates'

/*
 * The words on a card. They say where the day stands and nothing about how it went: an empty day or
 * an unfinished one gets no comment. The wording stays the same from day to day and only the part
 * that differs changes (docs/DESIGN.md §10).
 */

/** Shown in place of the list on a day without todos. It has no tense, so it reads the same for any day. */
export function emptyDayLine(day: DayKey, today: DayKey): string {
  const label = relativeLabel(day, today)
  return `Nothing planned for ${label === null ? 'this day' : label.toLowerCase()}.`
}

/** Added to the header line once nothing on the day is left open. */
export const CLEARED_LABEL = 'Cleared'
