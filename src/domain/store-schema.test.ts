import { describe, expect, it } from 'vitest'
import { isDayKey, parseStoreData } from './store-schema'

describe('isDayKey', () => {
  it('accepts YYYY-MM-DD only', () => {
    expect(isDayKey('2026-09-19')).toBe(true)
    expect(isDayKey('2026-9-19')).toBe(false)
    expect(isDayKey('today')).toBe(false)
  })
})

describe('parseStoreData', () => {
  const todo = { id: 'a', text: 'Buy milk', status: 'done' }

  it('accepts valid data', () => {
    expect(parseStoreData({ version: 1, days: { '2026-09-19': [todo] } })).toEqual({
      version: 1,
      days: { '2026-09-19': [todo] }
    })
  })

  it('accepts files written before the version field existed', () => {
    expect(parseStoreData({ days: { '2026-09-19': [todo] } }).version).toBe(1)
    expect(parseStoreData({})).toEqual({ version: 1, days: {} })
  })

  it('reads a todo dropped by an older version as done', () => {
    const parsed = parseStoreData({ days: { '2026-09-19': [{ ...todo, status: 'dropped' }] } })
    expect(parsed.days['2026-09-19']).toEqual([todo])
  })

  it('keeps a note and leaves the key off a todo without one', () => {
    const noted = { ...todo, note: '# Plan\n\n- oat' }
    expect(parseStoreData({ days: { '2026-09-19': [noted, todo] } }).days['2026-09-19']).toEqual([
      noted,
      todo
    ])
    expect(parseStoreData({ days: { '2026-09-19': [todo] } }).days['2026-09-19']?.[0]).not.toHaveProperty(
      'note'
    )
  })

  it('reads an empty note as no note', () => {
    const parsed = parseStoreData({ days: { '2026-09-19': [{ ...todo, note: '' }] } })
    expect(parsed.days['2026-09-19']?.[0]).not.toHaveProperty('note')
  })

  it('strips unknown todo fields', () => {
    const parsed = parseStoreData({ days: { '2026-09-19': [{ ...todo, extra: true }] } })
    expect(parsed.days['2026-09-19']).toEqual([todo])
  })

  it.each([
    ['not an object', null],
    ['days is a list', { days: [] }],
    ['an invalid day key', { days: { someday: [] } }],
    ['todos is not a list', { days: { '2026-09-19': {} } }],
    ['a todo without an id', { days: { '2026-09-19': [{ text: 'x', status: 'open' }] } }],
    ['a todo without a text', { days: { '2026-09-19': [{ id: 'a', status: 'open' }] } }],
    ['an unknown status', { days: { '2026-09-19': [{ id: 'a', text: 'x', status: 'later' }] } }],
    [
      'a note that is not a string',
      { days: { '2026-09-19': [{ id: 'a', text: 'x', status: 'open', note: 1 }] } }
    ]
  ])('rejects %s', (_name, value) => {
    expect(() => parseStoreData(value)).toThrow(TypeError)
  })
})
