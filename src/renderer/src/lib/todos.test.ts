import { describe, expect, it } from 'vitest'
import type { DaysMap, Todo } from '@shared/todo'
import { createTodo, daysReducer, displayOrder, resolvedIds } from './todos'

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

  it('restores a removed todo to the place it had', () => {
    const removed = daysReducer(days, { type: 'removed', day: DAY, id: 'milk' })
    expect(daysReducer(removed, { type: 'restored', day: DAY, todo: milk, index: 0 })).toEqual(days)
  })

  it('restores the last todo of a day, whose entry was dropped', () => {
    expect(daysReducer({}, { type: 'restored', day: DAY, todo: milk, index: 0 })).toEqual({ [DAY]: [milk] })
  })

  it('restores to the end when the list got shorter in the meantime', () => {
    const next = daysReducer({ [DAY]: [milk] }, { type: 'restored', day: DAY, todo: taxes, index: 5 })
    expect(next[DAY]).toEqual([milk, taxes])
  })

  it('ignores a restore of a todo that is already there', () => {
    expect(daysReducer(days, { type: 'restored', day: DAY, todo: milk, index: 1 })).toBe(days)
  })

  it('does not mutate its input', () => {
    const snapshot = structuredClone(days)
    daysReducer(days, { type: 'removed', day: DAY, id: 'milk' })
    expect(days).toEqual(snapshot)
  })
})

describe('displayOrder', () => {
  const done: Todo = { id: 'done', text: 'Call mum', status: 'done' }
  const dropped: Todo = { id: 'dropped', text: 'Iron shirts', status: 'dropped' }
  const todos = [done, milk, dropped, taxes]

  it('moves settled todos below the open ones and keeps the order within each group', () => {
    expect(displayOrder(todos, new Set(['done', 'dropped']))).toEqual([milk, taxes, done, dropped])
  })

  it('leaves a resolved todo in place until it has settled', () => {
    expect(displayOrder(todos, new Set(['dropped']))).toEqual([done, milk, taxes, dropped])
  })

  it('leaves a reopened todo at the bottom until it has settled', () => {
    expect(displayOrder([milk, taxes], new Set(['milk']))).toEqual([taxes, milk])
  })

  it('ignores settled ids of todos that are gone', () => {
    expect(displayOrder([milk, taxes], new Set(['removed']))).toEqual([milk, taxes])
  })
})

describe('resolvedIds', () => {
  it('collects the todos that are done or dropped', () => {
    const done: Todo = { id: 'done', text: 'Call mum', status: 'done' }
    const dropped: Todo = { id: 'dropped', text: 'Iron shirts', status: 'dropped' }
    expect(resolvedIds([done, milk, dropped])).toEqual(new Set(['done', 'dropped']))
  })
})
