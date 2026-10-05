import { describe, expect, it } from 'vitest'
import { dayDetail, dayTitle, daysSince, emptyDayLine, moveTarget, sinceLine } from './copy'

describe('dayTitle', () => {
  it('uses the name of the day where it has one', () => {
    expect(dayTitle('2026-09-20', '2026-09-20', 'en-US')).toBe('Today')
    expect(dayTitle('2026-09-19', '2026-09-20', 'en-US')).toBe('Yesterday')
    expect(dayTitle('2026-09-21', '2026-09-20', 'en-US')).toBe('Tomorrow')
  })

  it('uses the weekday for any other day', () => {
    expect(dayTitle('2026-09-24', '2026-09-20', 'en-US')).toBe('Thursday')
  })
})

describe('dayDetail', () => {
  it('gives the whole date under a name', () => {
    expect(dayDetail('2026-09-20', '2026-09-20', 'en-US')).toBe('Sunday, September 20')
  })

  it('gives the rest of the date and the distance under a weekday', () => {
    expect(dayDetail('2026-09-24', '2026-09-20', 'en-US')).toBe('September 24 · in 4 days')
    expect(dayDetail('2026-09-17', '2026-09-20', 'en-US')).toBe('September 17 · 3 days ago')
  })
})

describe('emptyDayLine', () => {
  it('names the day the way the header does', () => {
    expect(emptyDayLine('2026-09-20', '2026-09-20')).toBe('Nothing planned for today.')
    expect(emptyDayLine('2026-09-21', '2026-09-20')).toBe('Nothing planned for tomorrow.')
    expect(emptyDayLine('2026-09-19', '2026-09-20')).toBe('Nothing planned for yesterday.')
  })

  it('says the same about any other day, past or future', () => {
    expect(emptyDayLine('2026-09-10', '2026-09-20')).toBe('Nothing planned for this day.')
    expect(emptyDayLine('2026-09-30', '2026-09-20')).toBe('Nothing planned for this day.')
  })
})

describe('moveTarget', () => {
  it('sends a todo of today to tomorrow, the way the right arrow goes', () => {
    expect(moveTarget('2026-09-20', '2026-09-20')).toEqual({
      day: '2026-09-21',
      name: 'tomorrow',
      direction: 'next'
    })
  })

  it('sends a todo of a past day forward to today', () => {
    expect(moveTarget('2026-09-19', '2026-09-20')).toEqual({
      day: '2026-09-20',
      name: 'today',
      direction: 'next'
    })
    expect(moveTarget('2026-09-01', '2026-09-20')).toEqual({
      day: '2026-09-20',
      name: 'today',
      direction: 'next'
    })
  })

  it('sends a todo of a future day back to today', () => {
    expect(moveTarget('2026-09-21', '2026-09-20')).toEqual({
      day: '2026-09-20',
      name: 'today',
      direction: 'previous'
    })
    expect(moveTarget('2026-10-05', '2026-09-20')).toEqual({
      day: '2026-09-20',
      name: 'today',
      direction: 'previous'
    })
  })

  it("crosses the year for a todo of New Year's Eve", () => {
    expect(moveTarget('2026-12-31', '2026-12-31').day).toBe('2027-01-01')
  })
})

describe('sinceLine', () => {
  it('says only "today" on the day it was stuck', () => {
    expect(sinceLine('2026-10-05', '2026-10-05', 'en-US')).toBe('Since today')
  })

  it('gives the start day and the days since', () => {
    expect(sinceLine('2026-10-04', '2026-10-05', 'en-US')).toBe('Since Sun, Oct 4 · 1 day')
    expect(sinceLine('2026-09-28', '2026-10-03', 'en-US')).toBe('Since Mon, Sep 28 · 5 days')
    expect(sinceLine('2026-08-03', '2026-10-05', 'en-US')).toBe('Since Mon, Aug 3 · 63 days')
  })

  it('names the year of a start in another year', () => {
    expect(sinceLine('2026-12-30', '2027-01-02', 'en-US')).toBe('Since Wed, Dec 30, 2026 · 3 days')
  })

  it('gives the start day without a count on a future card', () => {
    expect(sinceLine('2026-10-10', '2026-10-05', 'en-US')).toBe('From Sat, Oct 10')
  })

  it('follows the locale', () => {
    expect(sinceLine('2026-09-28', '2026-10-03', 'de-DE')).toBe('Since Mo., 28. Sept. · 5 days')
  })
})

describe('daysSince', () => {
  it('counts whole days, across months and years', () => {
    expect(daysSince('2026-10-05', '2026-10-05')).toBe(0)
    expect(daysSince('2026-09-28', '2026-10-03')).toBe(5)
    expect(daysSince('2026-12-30', '2027-01-02')).toBe(3)
    expect(daysSince('2026-10-20', '2026-10-27')).toBe(7)
  })

  it('is never below zero for a start still ahead', () => {
    expect(daysSince('2026-10-10', '2026-10-05')).toBe(0)
  })
})
