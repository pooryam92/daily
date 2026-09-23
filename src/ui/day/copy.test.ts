import { describe, expect, it } from 'vitest'
import { dayDetail, dayTitle, emptyDayLine, moveTarget } from './copy'

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
