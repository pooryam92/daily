import { describe, expect, it } from 'vitest'
import type { DaysMap, Todo } from './todo'
import { createTodo, dayProgress, daysReducer, displayOrder, resolvedIds } from './todo-rules'

const DAY = '2026-09-19'
const milk: Todo = { id: 'milk', text: 'Buy milk', status: 'open' }
const taxes: Todo = { id: 'taxes', text: 'Do taxes', status: 'open' }
const plants: Todo = { id: 'plants', text: 'Water plants', status: 'open' }
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
    expect(daysReducer(days, { type: 'added', day: DAY, todo: plants })[DAY]).toEqual([milk, taxes, plants])
  })

  it('adds a todo to a day that has none yet', () => {
    const next = daysReducer(days, { type: 'added', day: '2026-09-20', todo: milk })
    expect(next['2026-09-20']).toEqual([milk])
    expect(next[DAY]).toBe(days[DAY])
  })

  it('marks a todo', () => {
    const next = daysReducer(days, { type: 'doneToggled', day: DAY, id: 'milk' })
    expect(next[DAY]).toEqual([{ ...milk, status: 'done' }, taxes])
  })

  it('reopens a done todo', () => {
    const done = daysReducer(days, { type: 'doneToggled', day: DAY, id: 'milk' })
    const reopened = daysReducer(done, { type: 'doneToggled', day: DAY, id: 'milk' })
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

  it('moves a todo to the place of the todo it was dropped on', () => {
    const three = { [DAY]: [milk, taxes, plants] }
    expect(daysReducer(three, { type: 'reordered', day: DAY, id: 'milk', targetId: 'plants' })[DAY]).toEqual([
      taxes,
      plants,
      milk
    ])
    expect(daysReducer(three, { type: 'reordered', day: DAY, id: 'plants', targetId: 'milk' })[DAY]).toEqual([
      plants,
      milk,
      taxes
    ])
  })

  it('ignores a reorder whose ends are not both there', () => {
    expect(daysReducer(days, { type: 'reordered', day: DAY, id: 'milk', targetId: 'gone' })).toBe(days)
    expect(daysReducer(days, { type: 'reordered', day: DAY, id: 'milk', targetId: 'milk' })).toBe(days)
  })

  it('edits the text of a todo and leaves its status alone', () => {
    const done = daysReducer(days, { type: 'doneToggled', day: DAY, id: 'milk' })
    const next = daysReducer(done, { type: 'edited', day: DAY, id: 'milk', text: 'Buy oat milk' })
    expect(next[DAY]).toEqual([{ ...milk, text: 'Buy oat milk', status: 'done' }, taxes])
  })

  it('ignores an edit that changes nothing', () => {
    expect(daysReducer(days, { type: 'edited', day: DAY, id: 'milk', text: milk.text })).toBe(days)
    expect(daysReducer(days, { type: 'edited', day: DAY, id: 'gone', text: 'Whatever' })).toBe(days)
  })

  it('sets the note of a todo', () => {
    const next = daysReducer(days, { type: 'noteChanged', day: DAY, id: 'milk', note: 'Oat, not soy' })
    expect(next[DAY]).toEqual([{ ...milk, note: 'Oat, not soy' }, taxes])
  })

  it('drops the note key when the note is emptied', () => {
    const noted = daysReducer(days, { type: 'noteChanged', day: DAY, id: 'milk', note: 'Oat' })
    const cleared = daysReducer(noted, { type: 'noteChanged', day: DAY, id: 'milk', note: ' \n ' })
    expect(cleared[DAY]?.[0]).not.toHaveProperty('note')
    expect(cleared).toEqual(days)
  })

  it('ignores a note change that changes nothing', () => {
    expect(daysReducer(days, { type: 'noteChanged', day: DAY, id: 'milk', note: '' })).toBe(days)
    expect(daysReducer(days, { type: 'noteChanged', day: DAY, id: 'gone', note: 'Oat' })).toBe(days)
    const noted = daysReducer(days, { type: 'noteChanged', day: DAY, id: 'milk', note: 'Oat' })
    expect(daysReducer(noted, { type: 'noteChanged', day: DAY, id: 'milk', note: 'Oat' })).toBe(noted)
  })

  it('keeps the note when a todo is moved to another day', () => {
    const noted = daysReducer(days, { type: 'noteChanged', day: DAY, id: 'milk', note: 'Oat' })
    const moved = daysReducer(noted, { type: 'moved', from: DAY, to: '2026-09-20', id: 'milk' })
    expect(moved['2026-09-20']).toEqual([{ ...milk, note: 'Oat' }])
  })

  it('moves a todo to the end of another day, unchanged', () => {
    const done: Todo = { ...milk, status: 'done' }
    const two: DaysMap = { [DAY]: [done, taxes], '2026-09-20': [plants] }
    const next = daysReducer(two, { type: 'moved', from: DAY, to: '2026-09-20', id: 'milk' })
    expect(next).toEqual({ [DAY]: [taxes], '2026-09-20': [plants, done] })
  })

  it('moves a todo to a day that has none yet, and drops the entry of a day it empties', () => {
    const next = daysReducer({ [DAY]: [milk] }, { type: 'moved', from: DAY, to: '2026-09-20', id: 'milk' })
    expect(next).toEqual({ '2026-09-20': [milk] })
  })

  it('moves a todo back to the place it had, or to the end when the list got shorter', () => {
    const moved = daysReducer(days, { type: 'moved', from: DAY, to: '2026-09-20', id: 'milk' })
    expect(daysReducer(moved, { type: 'moved', from: '2026-09-20', to: DAY, id: 'milk', index: 0 })).toEqual(
      days
    )
    expect(
      daysReducer(moved, { type: 'moved', from: '2026-09-20', to: DAY, id: 'milk', index: 5 })[DAY]
    ).toEqual([taxes, milk])
  })

  it('ignores a move of a todo that is not on the day it leaves, or already on the day it goes to', () => {
    expect(daysReducer(days, { type: 'moved', from: DAY, to: '2026-09-20', id: 'gone' })).toBe(days)
    expect(daysReducer(days, { type: 'moved', from: '2026-09-20', to: DAY, id: 'milk' })).toBe(days)
    expect(daysReducer(days, { type: 'moved', from: DAY, to: DAY, id: 'milk' })).toBe(days)
    // The second click on the same undo: the todo is back already.
    const moved = daysReducer(days, { type: 'moved', from: DAY, to: '2026-09-20', id: 'milk' })
    const back = daysReducer(moved, { type: 'moved', from: '2026-09-20', to: DAY, id: 'milk', index: 0 })
    expect(daysReducer(back, { type: 'moved', from: '2026-09-20', to: DAY, id: 'milk', index: 0 })).toBe(back)
  })

  it('does not mutate its input', () => {
    const snapshot = structuredClone(days)
    daysReducer(days, { type: 'removed', day: DAY, id: 'milk' })
    expect(days).toEqual(snapshot)
  })
})

describe('displayOrder', () => {
  const mum: Todo = { id: 'mum', text: 'Call mum', status: 'done' }
  const shirts: Todo = { id: 'shirts', text: 'Iron shirts', status: 'done' }
  const todos = [mum, milk, shirts, taxes]

  it('moves settled todos below the open ones and keeps the order within each group', () => {
    expect(displayOrder(todos, new Set(['mum', 'shirts']))).toEqual([milk, taxes, mum, shirts])
  })

  it('leaves a resolved todo in place until it has settled', () => {
    expect(displayOrder(todos, new Set(['shirts']))).toEqual([mum, milk, taxes, shirts])
  })

  it('leaves a reopened todo at the bottom until it has settled', () => {
    expect(displayOrder([milk, taxes], new Set(['milk']))).toEqual([taxes, milk])
  })

  it('ignores settled ids of todos that are gone', () => {
    expect(displayOrder([milk, taxes], new Set(['removed']))).toEqual([milk, taxes])
  })
})

describe('resolvedIds', () => {
  it('collects the todos that are done', () => {
    const mum: Todo = { id: 'mum', text: 'Call mum', status: 'done' }
    const shirts: Todo = { id: 'shirts', text: 'Iron shirts', status: 'done' }
    expect(resolvedIds([mum, milk, shirts])).toEqual(new Set(['mum', 'shirts']))
  })
})

describe('dayProgress', () => {
  const done: Todo = { ...milk, status: 'done' }

  it('counts the done todos', () => {
    expect(dayProgress([done, taxes])).toEqual({ resolved: 1, total: 2, cleared: false })
  })

  it('is cleared once nothing is left open', () => {
    expect(dayProgress([done, { ...taxes, status: 'done' }])).toEqual({
      resolved: 2,
      total: 2,
      cleared: true
    })
  })

  it('does not call a day without todos cleared', () => {
    expect(dayProgress([])).toEqual({ resolved: 0, total: 0, cleared: false })
  })
})
