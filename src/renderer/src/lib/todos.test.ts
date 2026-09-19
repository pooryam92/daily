import { describe, expect, it } from 'vitest'
import type { DaysMap, Todo } from '@shared/todo'
import { createTodo, daysReducer } from './todos'

const DAY = '2026-09-19'
const milk: Todo = { id: 'milk', text: 'Buy milk', status: 'open' }
const taxes: Todo = { id: 'taxes', text: 'Do taxes', status: 'open' }
const days: DaysMap = { [DAY]: [milk, taxes] }

describe('createTodo', () => {
  it('creates an open todo with a unique id', () => {
    const a = createTodo('Buy milk')
    const b = createTodo('Buy milk')
    expect(a).toMatchObject({ text: 'Buy milk', status: 'open' })
    expect(a.id).not.toBe(b.id)
  })
})

describe('daysReducer', () => {
  it('adds a todo to the end of a day', () => {
    const plants: Todo = { id: 'plants', text: 'Water plants', status: 'open' }
    expect(daysReducer(days, { type: 'added', day: DAY, todo: plants })[DAY]).toEqual([milk, taxes, plants])
  })

  it('adds a todo to a day that has none yet', () => {
    const next = daysReducer(days, { type: 'added', day: '2026-09-20', todo: milk })
    expect(next['2026-09-20']).toEqual([milk])
    expect(next[DAY]).toBe(days[DAY])
  })

  it('marks a todo', () => {
    const next = daysReducer(days, { type: 'statusToggled', day: DAY, id: 'milk', status: 'done' })
    expect(next[DAY]).toEqual([{ ...milk, status: 'done' }, taxes])
  })

  it('switches directly between marks', () => {
    const done = daysReducer(days, { type: 'statusToggled', day: DAY, id: 'milk', status: 'done' })
    const dropped = daysReducer(done, { type: 'statusToggled', day: DAY, id: 'milk', status: 'dropped' })
    expect(dropped[DAY]?.[0]?.status).toBe('dropped')
  })

  it('reopens a todo when it is marked with the status it already has', () => {
    const done = daysReducer(days, { type: 'statusToggled', day: DAY, id: 'milk', status: 'done' })
    const reopened = daysReducer(done, { type: 'statusToggled', day: DAY, id: 'milk', status: 'done' })
    expect(reopened).toEqual(days)
  })

  it('removes a todo', () => {
    expect(daysReducer(days, { type: 'removed', day: DAY, id: 'milk' })[DAY]).toEqual([taxes])
  })

  it('drops the entry of a day when its last todo is removed', () => {
    const next = daysReducer({ [DAY]: [milk] }, { type: 'removed', day: DAY, id: 'milk' })
    expect(next).toEqual({})
  })

  it('does not mutate its input', () => {
    const snapshot = structuredClone(days)
    daysReducer(days, { type: 'removed', day: DAY, id: 'milk' })
    expect(days).toEqual(snapshot)
  })
})
