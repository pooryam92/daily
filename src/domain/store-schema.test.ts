import { describe, expect, it } from 'vitest'
import { STORE_VERSION } from './store'
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

  it('strips unknown todo fields', () => {
    const parsed = parseStoreData({ days: { '2026-09-19': [{ ...todo, extra: true }] } })
    expect(parsed.days['2026-09-19']).toEqual([todo])
  })

  it('reads a file written before steps existed exactly as it was', () => {
    const file = {
      version: 1,
      days: {
        '2026-09-19': [todo, { id: 'b', text: 'Call mum', status: 'open' }],
        '2026-09-20': [{ id: 'c', text: 'Dentist', status: 'open' }]
      }
    }
    const parsed = parseStoreData(JSON.parse(JSON.stringify(file)))
    expect(parsed).toStrictEqual(file)
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(file))
  })

  it('keeps version 1 for a file with steps', () => {
    const parent = { id: 'p', text: 'Set up CI', status: 'open', steps: [todo] }
    expect(STORE_VERSION).toBe(1)
    expect(parseStoreData({ version: 1, days: { '2026-09-19': [parent] } }).version).toBe(1)
  })

  it('reads a todo with steps', () => {
    const parent = {
      id: 'p',
      text: 'Set up CI',
      status: 'open',
      steps: [todo, { id: 'b', text: 'Cache', status: 'open' }]
    }
    expect(parseStoreData({ days: { '2026-09-19': [parent] } }).days['2026-09-19']).toStrictEqual([parent])
  })

  it('leaves the steps key off a todo whose steps are empty, or that has none', () => {
    const parsed = parseStoreData({ days: { '2026-09-19': [{ ...todo, steps: [] }, todo] } })
    expect(parsed.days['2026-09-19']).toStrictEqual([todo, todo])
    expect(parsed.days['2026-09-19']?.[1]).not.toHaveProperty('steps')
  })

  it('accepts a step with an empty steps list, and leaves the key off', () => {
    const parsed = parseStoreData({
      days: { '2026-09-19': [{ id: 'p', text: 'x', status: 'open', steps: [{ ...todo, steps: [] }] }] }
    })
    expect(parsed.days['2026-09-19']?.[0]?.steps).toStrictEqual([todo])
  })

  it('strips unknown step fields and reads a dropped step as done', () => {
    const parent = {
      id: 'p',
      text: 'x',
      status: 'open',
      steps: [{ ...todo, status: 'dropped', extra: true }]
    }
    expect(parseStoreData({ days: { '2026-09-19': [parent] } }).days['2026-09-19']).toStrictEqual([
      { ...parent, steps: [todo] }
    ])
  })

  it.each([
    ['not an object', null],
    ['days is a list', { days: [] }],
    ['an invalid day key', { days: { someday: [] } }],
    ['todos is not a list', { days: { '2026-09-19': {} } }],
    ['a todo without an id', { days: { '2026-09-19': [{ text: 'x', status: 'open' }] } }],
    ['a todo without a text', { days: { '2026-09-19': [{ id: 'a', status: 'open' }] } }],
    ['an unknown status', { days: { '2026-09-19': [{ id: 'a', text: 'x', status: 'later' }] } }],
    ['steps that are not a list', { days: { '2026-09-19': [{ ...todo, steps: {} }] } }],
    ['steps that are null', { days: { '2026-09-19': [{ ...todo, steps: null }] } }],
    ['a step that is not a todo', { days: { '2026-09-19': [{ ...todo, steps: [{ id: 'b' }] }] } }],
    [
      'a step with steps',
      { days: { '2026-09-19': [{ ...todo, steps: [{ ...todo, id: 'b', steps: [todo] }] }] } }
    ]
  ])('rejects %s', (_name, value) => {
    expect(() => parseStoreData(value)).toThrow(TypeError)
  })
})

describe('parseStoreData with a fold', () => {
  const DAY = '2026-09-19'
  const step = { id: 's', text: 'Cache', status: 'open' }
  const parent = { id: 'p', text: 'Set up CI', status: 'open', steps: [step] }
  const parsed = (todos: unknown[]) => parseStoreData({ version: 1, days: { [DAY]: todos } }).days[DAY]

  it('keeps folded on a todo with steps, open or done', () => {
    expect(parsed([{ ...parent, folded: true }])).toStrictEqual([{ ...parent, folded: true }])
    const done = { ...parent, status: 'done', steps: [{ ...step, status: 'done' }], folded: true }
    expect(parsed([done])).toStrictEqual([done])
  })

  it.each([
    ['false', false],
    ['a string', 'true'],
    ['a number', 1],
    ['null', null],
    ['an object', {}]
  ])('drops a folded that is %s, without an error', (_name, folded) => {
    const [todo] = parsed([{ ...parent, folded }]) ?? []
    expect(todo).toStrictEqual(parent)
    expect(todo).not.toHaveProperty('folded')
  })

  it('drops folded on a todo without steps, or with an empty steps list', () => {
    const plain = { id: 'a', text: 'Buy milk', status: 'open' }
    const todos = parsed([
      { ...plain, folded: true },
      { ...plain, id: 'b', steps: [], folded: true }
    ])
    expect(todos).toStrictEqual([plain, { ...plain, id: 'b' }])
    for (const todo of todos ?? []) expect(Object.keys(todo)).toEqual(['id', 'text', 'status'])
  })

  it('drops folded on a step', () => {
    const todos = parsed([{ ...parent, steps: [{ ...step, folded: true }] }])
    expect(todos).toStrictEqual([parent])
    expect(todos?.[0]?.steps?.[0]).not.toHaveProperty('folded')
  })

  it('never reads a todo as having folded: undefined', () => {
    for (const todo of parsed([parent, { ...parent, id: 'q', folded: false }]) ?? []) {
      expect(Object.keys(todo)).not.toContain('folded')
    }
  })

  it('reads a file with steps and no fold exactly as it was, and keeps version 1', () => {
    const file = { version: 1, days: { [DAY]: [parent, { id: 'a', text: 'Buy milk', status: 'done' }] } }
    const back = parseStoreData(JSON.parse(JSON.stringify(file)))
    expect(JSON.stringify(back)).toBe(JSON.stringify(file))
    expect(parseStoreData({ version: 1, days: { [DAY]: [{ ...parent, folded: true }] } }).version).toBe(1)
  })
})
