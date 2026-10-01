import { describe, expect, it } from 'vitest'
import type { DaysMap, Todo } from './todo'
import {
  createTodo,
  dayProgress,
  daysReducer,
  displayOrder,
  locate,
  resolvedIds,
  stepProgress
} from './todo-rules'
import type { TodoAction } from './todo-rules'

const DAY = '2026-09-19'
const milk: Todo = { id: 'milk', text: 'Buy milk', status: 'open' }
const taxes: Todo = { id: 'taxes', text: 'Do taxes', status: 'open' }
const plants: Todo = { id: 'plants', text: 'Water plants', status: 'open' }
const days: DaysMap = { [DAY]: [milk, taxes] }
const workflow: Todo = { id: 'workflow', text: 'Write the workflow', status: 'open' }
const lint: Todo = { id: 'lint', text: 'Fix lint', status: 'open' }
const cache: Todo = { id: 'cache', text: 'Add a cache', status: 'open' }
const ci: Todo = { id: 'ci', text: 'Set up CI', status: 'open', steps: [workflow, lint, cache] }
const withSteps: DaysMap = { [DAY]: [milk, ci] }
const finished = (todo: Todo): Todo => ({ ...todo, status: 'done' })

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
    const nested = structuredClone(withSteps)
    daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    expect(withSteps).toStrictEqual(nested)
  })
})

describe('daysReducer with steps', () => {
  it('adds a step to the end of its parent', () => {
    const next = daysReducer({ [DAY]: [milk] }, { type: 'added', day: DAY, todo: workflow, parentId: 'milk' })
    expect(next[DAY]).toStrictEqual([{ ...milk, steps: [workflow] }])
    const more = daysReducer(withSteps, { type: 'added', day: DAY, todo: plants, parentId: 'ci' })
    expect(more[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, lint, cache, plants] }])
  })

  it('ignores a step added to a parent that is gone, or that is a step', () => {
    expect(daysReducer(withSteps, { type: 'added', day: DAY, todo: plants, parentId: 'gone' })).toBe(
      withSteps
    )
    expect(daysReducer(withSteps, { type: 'added', day: DAY, todo: plants, parentId: 'lint' })).toBe(
      withSteps
    )
    expect(daysReducer({}, { type: 'added', day: DAY, todo: plants, parentId: 'ci' })).toStrictEqual({})
  })

  it('finishes the steps of a todo that is finished', () => {
    const next = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(next[DAY]).toStrictEqual([
      milk,
      { ...ci, status: 'done', steps: [workflow, lint, cache].map(finished) }
    ])
  })

  it('finishes the open steps of a todo whose steps were part done', () => {
    const part: DaysMap = { [DAY]: [{ ...ci, steps: [finished(workflow), lint, cache] }] }
    const next = daysReducer(part, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(next[DAY]).toStrictEqual([{ ...ci, status: 'done', steps: [workflow, lint, cache].map(finished) }])
  })

  it('leaves the parent open when every step is done', () => {
    const next = ['workflow', 'lint', 'cache'].reduce(
      (state, id) => daysReducer(state, { type: 'doneToggled', day: DAY, id }),
      withSteps
    )
    expect(next[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, lint, cache].map(finished) }])
  })

  it('leaves the steps done when their parent is reopened', () => {
    const closed = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    const reopened = daysReducer(closed, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(reopened[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, lint, cache].map(finished) }])
  })

  it('marks, reopens and edits a step and leaves its parent alone', () => {
    const marked = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'lint' })
    expect(marked[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, finished(lint), cache] }])
    expect(daysReducer(marked, { type: 'doneToggled', day: DAY, id: 'lint' })).toStrictEqual(withSteps)
    const edited = daysReducer(withSteps, { type: 'edited', day: DAY, id: 'lint', text: 'Fix types' })
    expect(edited[DAY]).toStrictEqual([
      milk,
      { ...ci, steps: [workflow, { ...lint, text: 'Fix types' }, cache] }
    ])
    expect(daysReducer(withSteps, { type: 'edited', day: DAY, id: 'lint', text: lint.text })).toBe(withSteps)
  })

  it('ignores a toggle or a removal of a todo that is not there', () => {
    expect(daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'gone' })).toBe(withSteps)
    expect(daysReducer(withSteps, { type: 'removed', day: DAY, id: 'gone' })).toBe(withSteps)
  })

  it('removes a step', () => {
    const next = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    expect(next[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, cache] }])
  })

  it('drops the steps key when the last step is removed', () => {
    const next = daysReducer(
      { [DAY]: [{ ...milk, steps: [lint] }] },
      { type: 'removed', day: DAY, id: 'lint' }
    )
    expect(next[DAY]).toStrictEqual([milk])
    expect(next[DAY]?.[0]).not.toHaveProperty('steps')
  })

  it('removes a parent with its steps, and a restore brings them all back', () => {
    const removed = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'ci' })
    expect(removed[DAY]).toStrictEqual([milk])
    expect(daysReducer(removed, { type: 'restored', day: DAY, todo: ci, index: 1 })).toStrictEqual(withSteps)
  })

  it('restores a removed step to the place it had in its parent', () => {
    const removed = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    const restored = daysReducer(removed, {
      type: 'restored',
      day: DAY,
      todo: lint,
      index: 1,
      parentId: 'ci'
    })
    expect(restored).toStrictEqual(withSteps)
  })

  it('restores the last step of a parent, whose key was dropped', () => {
    const next = daysReducer(
      { [DAY]: [milk] },
      { type: 'restored', day: DAY, todo: lint, index: 3, parentId: 'milk' }
    )
    expect(next[DAY]).toStrictEqual([{ ...milk, steps: [lint] }])
  })

  it('ignores a restore of a step whose parent is gone, or that is already there', () => {
    const restore = { type: 'restored', day: DAY, todo: plants, index: 0, parentId: 'gone' } as const
    expect(daysReducer(withSteps, restore)).toBe(withSteps)
    expect(daysReducer(withSteps, { type: 'restored', day: DAY, todo: lint, index: 0, parentId: 'ci' })).toBe(
      withSteps
    )
  })

  it('moves a step to the place of the step it was dropped on', () => {
    const next = daysReducer(withSteps, { type: 'reordered', day: DAY, id: 'workflow', targetId: 'cache' })
    expect(next[DAY]).toStrictEqual([milk, { ...ci, steps: [lint, cache, workflow] }])
  })

  it('ignores a reorder across lists', () => {
    expect(daysReducer(withSteps, { type: 'reordered', day: DAY, id: 'lint', targetId: 'milk' })).toBe(
      withSteps
    )
    expect(daysReducer(withSteps, { type: 'reordered', day: DAY, id: 'milk', targetId: 'lint' })).toBe(
      withSteps
    )
    const two: DaysMap = { [DAY]: [{ ...milk, steps: [plants] }, ci] }
    expect(daysReducer(two, { type: 'reordered', day: DAY, id: 'plants', targetId: 'lint' })).toBe(two)
  })

  it('moves a parent to another day with its steps', () => {
    const next = daysReducer(withSteps, { type: 'moved', from: DAY, to: '2026-09-20', id: 'ci' })
    expect(next).toStrictEqual({ [DAY]: [milk], '2026-09-20': [ci] })
  })

  it('ignores a move of a step', () => {
    expect(daysReducer(withSteps, { type: 'moved', from: DAY, to: '2026-09-20', id: 'lint' })).toBe(withSteps)
  })

  it('moves a parent back with its steps, to the place it had', () => {
    const moved = daysReducer(withSteps, { type: 'moved', from: DAY, to: '2026-09-20', id: 'ci' })
    const back = daysReducer(moved, { type: 'moved', from: '2026-09-20', to: DAY, id: 'ci', index: 1 })
    expect(back).toStrictEqual(withSteps)
  })

  it('never leaves an empty steps list behind', () => {
    const actions: TodoAction[] = [
      { type: 'added', day: DAY, todo: plants, parentId: 'milk' },
      { type: 'doneToggled', day: DAY, id: 'milk' },
      { type: 'removed', day: DAY, id: 'plants' },
      { type: 'doneToggled', day: DAY, id: 'milk' },
      { type: 'reordered', day: DAY, id: 'cache', targetId: 'workflow' },
      { type: 'removed', day: DAY, id: 'workflow' },
      { type: 'removed', day: DAY, id: 'lint' },
      { type: 'edited', day: DAY, id: 'cache', text: 'Cache it' },
      { type: 'removed', day: DAY, id: 'cache' },
      { type: 'doneToggled', day: DAY, id: 'ci' },
      { type: 'restored', day: DAY, todo: lint, index: 0, parentId: 'ci' },
      { type: 'removed', day: DAY, id: 'lint' },
      { type: 'moved', from: DAY, to: '2026-09-20', id: 'ci' }
    ]
    let state = withSteps
    for (const action of actions) {
      state = daysReducer(state, action)
      expect(JSON.stringify(state)).not.toContain('"steps":[]')
    }
    expect(state).toStrictEqual({
      [DAY]: [milk],
      '2026-09-20': [{ id: 'ci', text: 'Set up CI', status: 'done' }]
    })
  })
})

describe('locate', () => {
  it('finds a todo at the top level', () => {
    expect(locate([milk, ci], 'ci')).toEqual({ todo: ci, index: 1, parentId: undefined })
  })

  it("finds a step with its index among its parent's steps", () => {
    expect(locate([milk, ci], 'cache')).toEqual({ todo: cache, index: 2, parentId: 'ci' })
  })

  it('finds nothing for an id that is not there', () => {
    expect(locate([milk, ci], 'gone')).toBeUndefined()
  })
})

describe('stepProgress', () => {
  it('counts the done steps', () => {
    expect(stepProgress({ ...ci, steps: [finished(workflow), lint, cache] })).toEqual({ done: 1, total: 3 })
  })

  it('is 0/0 for a todo without steps', () => {
    expect(stepProgress(milk)).toEqual({ done: 0, total: 0 })
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

  it('leaves the steps of a todo as they are stored, done ones included', () => {
    const part: Todo = { ...ci, steps: [finished(workflow), lint, finished(cache)] }
    const shown = displayOrder([part, mum], new Set(['mum', 'workflow', 'cache']))
    expect(shown).toStrictEqual([part, mum])
    expect(shown[0]?.steps).toBe(part.steps)
  })
})

describe('resolvedIds', () => {
  it('collects the todos that are done', () => {
    const mum: Todo = { id: 'mum', text: 'Call mum', status: 'done' }
    const shirts: Todo = { id: 'shirts', text: 'Iron shirts', status: 'done' }
    expect(resolvedIds([mum, milk, shirts])).toEqual(new Set(['mum', 'shirts']))
  })

  it('collects the top-level todos only, never their steps', () => {
    const steps = [workflow, lint, cache].map(finished)
    expect(resolvedIds([{ ...ci, steps }])).toEqual(new Set())
    expect(resolvedIds([{ ...ci, status: 'done', steps }])).toEqual(new Set(['ci']))
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

  it('counts the top-level todos only', () => {
    expect(dayProgress([{ ...ci, steps: [finished(workflow), finished(lint), cache] }])).toEqual({
      resolved: 0,
      total: 1,
      cleared: false
    })
  })

  it('does not call a day without todos cleared', () => {
    expect(dayProgress([])).toEqual({ resolved: 0, total: 0, cleared: false })
  })
})
