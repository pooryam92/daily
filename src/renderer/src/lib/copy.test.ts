import { describe, expect, it } from 'vitest'
import { emptyDayLine } from './copy'

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
