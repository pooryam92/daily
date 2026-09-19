import { describe, expect, it } from 'vitest'
import { addDays, dayIndex, formatDay, formatWeekday, fromDayKey, relativeLabel, toDayKey } from './dates'

describe('toDayKey / fromDayKey', () => {
  it('uses the local date, zero-padded', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('round-trips', () => {
    expect(toDayKey(fromDayKey('2026-09-19'))).toBe('2026-09-19')
  })
})

describe('dayIndex', () => {
  it('puts consecutive days 1 apart', () => {
    expect(dayIndex('2027-01-01') - dayIndex('2026-12-31')).toBe(1)
    expect(dayIndex('2026-09-20') - dayIndex('2026-09-13')).toBe(7)
  })

  it('is not thrown off by daylight-saving changes', () => {
    expect(dayIndex('2026-03-30') - dayIndex('2026-03-28')).toBe(2)
    expect(dayIndex('2026-10-26') - dayIndex('2026-10-24')).toBe(2)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('moves exactly one day across a daylight-saving change', () => {
    // Europe switches on the last Sundays of March and October; this holds in any time zone.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('formatDay', () => {
  it('formats as weekday, day and month', () => {
    expect(formatDay('2026-09-19', 'en-US')).toBe('Saturday, September 19')
  })
})

describe('formatWeekday', () => {
  it('formats as the short weekday', () => {
    expect(formatWeekday('2026-09-19', 'en-US')).toBe('Sat')
  })
})

describe('relativeLabel', () => {
  it('names the days around today', () => {
    expect(relativeLabel('2026-09-19', '2026-09-19')).toBe('Today')
    expect(relativeLabel('2026-09-18', '2026-09-19')).toBe('Yesterday')
    expect(relativeLabel('2026-09-20', '2026-09-19')).toBe('Tomorrow')
  })

  it('has no label for other days', () => {
    expect(relativeLabel('2026-09-21', '2026-09-19')).toBeNull()
  })
})
