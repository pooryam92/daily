import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareDays,
  dayIndex,
  formatDate,
  formatDay,
  formatDistance,
  formatLongWeekday,
  formatWeekday,
  fromDayKey,
  relativeLabel,
  toDayKey
} from './dates'

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

describe('compareDays', () => {
  it('is negative before, positive after and 0 on the same day', () => {
    expect(compareDays('2026-09-19', '2026-09-20')).toBeLessThan(0)
    expect(compareDays('2026-09-21', '2026-09-20')).toBeGreaterThan(0)
    expect(compareDays('2026-09-20', '2026-09-20')).toBe(0)
  })

  it('compares across a year boundary', () => {
    expect(compareDays('2027-01-01', '2026-12-31')).toBe(1)
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
    expect(formatDay('2026-09-19', '2026-09-20', 'en-US')).toBe('Saturday, September 19')
  })

  it('says the year only when it is not the year of today', () => {
    expect(formatDay('2027-01-01', '2026-12-31', 'en-US')).toBe('Friday, January 1, 2027')
  })
})

describe('formatDate', () => {
  it('formats as day and month', () => {
    expect(formatDate('2026-09-24', '2026-09-20', 'en-US')).toBe('September 24')
    expect(formatDate('2026-09-24', '2026-09-20', 'en-GB')).toBe('24 September')
  })

  it('says the year only when it is not the year of today', () => {
    expect(formatDate('2025-12-30', '2026-01-02', 'en-US')).toBe('December 30, 2025')
  })
})

describe('formatLongWeekday', () => {
  it('formats as the whole weekday', () => {
    expect(formatLongWeekday('2026-09-24', 'en-US')).toBe('Thursday')
  })
})

describe('formatDistance', () => {
  it('counts the days to or from today', () => {
    expect(formatDistance('2026-09-24', '2026-09-20', 'en-US')).toBe('in 4 days')
    expect(formatDistance('2026-09-17', '2026-09-20', 'en-US')).toBe('3 days ago')
  })

  it('counts across a daylight-saving change', () => {
    expect(formatDistance('2026-03-30', '2026-03-28', 'en-US')).toBe('in 2 days')
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
