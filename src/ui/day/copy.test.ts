import { describe, expect, it } from 'vitest'
import { dayDetail, dayTitle, emptyDayLine } from './copy'

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
