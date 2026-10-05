import { describe, expect, it } from 'vitest'
import type { DayKey, DaysMap, Todo } from './todo'
import {
  createTodo,
  dayProgress,
  daysReducer,
  displayOrder,
  locate,
  resolvedIds,
  stepProgress,
  travel
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

  it('finishes and folds the steps of a todo that is finished', () => {
    const next = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(next[DAY]).toStrictEqual([
      milk,
      { ...ci, status: 'done', steps: [workflow, lint, cache].map(finished), folded: true }
    ])
  })

  it('finishes the open steps of a todo whose steps were part done', () => {
    const part: DaysMap = { [DAY]: [{ ...ci, steps: [finished(workflow), lint, cache] }] }
    const next = daysReducer(part, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(next[DAY]).toStrictEqual([
      { ...ci, status: 'done', steps: [workflow, lint, cache].map(finished), folded: true }
    ])
  })

  it('leaves the parent open when every step is done', () => {
    const next = ['workflow', 'lint', 'cache'].reduce(
      (state, id) => daysReducer(state, { type: 'doneToggled', day: DAY, id }),
      withSteps
    )
    expect(next[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, lint, cache].map(finished) }])
  })

  it('leaves the steps done, and folded, when their parent is reopened', () => {
    const closed = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    const reopened = daysReducer(closed, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(reopened[DAY]).toStrictEqual([
      milk,
      { ...ci, steps: [workflow, lint, cache].map(finished), folded: true }
    ])
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

  it('restores a step to its parent on the day the parent has moved to since', () => {
    const removed = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    const moved = daysReducer(removed, { type: 'moved', from: DAY, to: '2026-09-20', id: 'ci' })
    const restored = daysReducer(moved, { type: 'restored', day: DAY, todo: lint, index: 1, parentId: 'ci' })
    expect(restored).toStrictEqual({ [DAY]: [milk], '2026-09-20': [ci] })
  })

  it('ignores a restore of a step whose parent is gone, or that is already there', () => {
    const restore = { type: 'restored', day: DAY, todo: plants, index: 0, parentId: 'gone' } as const
    expect(daysReducer(withSteps, restore)).toBe(withSteps)
    expect(daysReducer(withSteps, { type: 'restored', day: DAY, todo: lint, index: 0, parentId: 'ci' })).toBe(
      withSteps
    )
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
      { type: 'placed', day: DAY, id: 'cache', parentId: 'ci', beforeId: 'workflow' },
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
      // Restoring the open step into the done todo reopened it.
      '2026-09-20': [{ id: 'ci', text: 'Set up CI', status: 'open' }]
    })
  })
})

describe('daysReducer with a fold', () => {
  const folded: Todo = { ...ci, folded: true }
  const foldedDay: DaysMap = { [DAY]: [milk, folded] }
  const fold = (id: string): TodoAction => ({ type: 'foldToggled', day: DAY, id })

  it('folds an open todo with steps, and unfolds it again with no key left', () => {
    const next = daysReducer(withSteps, fold('ci'))
    expect(next[DAY]).toStrictEqual([milk, folded])
    const back = daysReducer(next, fold('ci'))
    expect(back).toStrictEqual(withSteps)
    expect(back[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('folds and unfolds a done todo, as an open one', () => {
    const done = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    const shown = daysReducer(done, fold('ci'))
    const finishedCi: Todo = { ...ci, status: 'done', steps: [workflow, lint, cache].map(finished) }
    expect(shown[DAY]).toStrictEqual([milk, finishedCi])
    expect(shown[DAY]?.[1]).not.toHaveProperty('folded')
    expect(daysReducer(shown, fold('ci'))[DAY]).toStrictEqual([milk, { ...finishedCi, folded: true }])
  })

  it('checking a todo without steps adds no fold', () => {
    const next = daysReducer(days, { type: 'doneToggled', day: DAY, id: 'milk' })
    expect(next[DAY]).toStrictEqual([{ ...milk, status: 'done' }, taxes])
    expect(Object.keys(next[DAY]?.[0] ?? {})).toEqual(['id', 'text', 'status'])
  })

  it('unchecking a todo leaves the fold as it is, folded or not', () => {
    const done = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(daysReducer(done, { type: 'doneToggled', day: DAY, id: 'ci' })[DAY]?.[1]).toHaveProperty(
      'folded',
      true
    )
    const shown = daysReducer(done, fold('ci'))
    const reopened = daysReducer(shown, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(reopened[DAY]?.[1]).toStrictEqual({ ...ci, steps: [workflow, lint, cache].map(finished) })
    expect(reopened[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('unchecking a step under a done todo reopens the todo, and leaves its fold as it is', () => {
    const done = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    const steps = [finished(workflow), lint, finished(cache)]
    const fromFolded = daysReducer(done, { type: 'doneToggled', day: DAY, id: 'lint' })
    expect(fromFolded[DAY]?.[1]).toStrictEqual({ ...ci, steps, folded: true })
    const shown = daysReducer(done, fold('ci'))
    const fromShown = daysReducer(shown, { type: 'doneToggled', day: DAY, id: 'lint' })
    expect(fromShown[DAY]?.[1]).toStrictEqual({ ...ci, steps })
    expect(fromShown[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('reopens and unfolds a done todo when the delete of an open step under it is undone', () => {
    const removed = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    const done = daysReducer(removed, { type: 'doneToggled', day: DAY, id: 'ci' })
    const undo = { type: 'restored', day: DAY, todo: lint, index: 1, parentId: 'ci' } as const
    const steps = [finished(workflow), lint, finished(cache)]
    // Folded by the check, or unfolded since: the step that comes back shows either way.
    for (const before of [done, daysReducer(done, fold('ci'))]) {
      const restored = daysReducer(before, undo)
      expect(restored[DAY]?.[1]).toStrictEqual({ ...ci, steps })
      expect(restored[DAY]?.[1]).not.toHaveProperty('folded')
    }
  })

  it('keeps a done todo done, and unfolds it, when a done step is restored under it', () => {
    const removed = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    const done = daysReducer(removed, { type: 'doneToggled', day: DAY, id: 'ci' })
    const restored = daysReducer(done, {
      type: 'restored',
      day: DAY,
      todo: finished(lint),
      index: 1,
      parentId: 'ci'
    })
    expect(restored[DAY]?.[1]).toStrictEqual({
      ...ci,
      status: 'done',
      steps: [workflow, lint, cache].map(finished)
    })
    expect(restored[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('reopens and unfolds a done todo when a step is added to it', () => {
    const done = daysReducer(withSteps, { type: 'doneToggled', day: DAY, id: 'ci' })
    const next = daysReducer(done, { type: 'added', day: DAY, todo: plants, parentId: 'ci' })
    expect(next[DAY]?.[1]).toStrictEqual({ ...ci, steps: [...[workflow, lint, cache].map(finished), plants] })
    const plain = daysReducer(days, { type: 'doneToggled', day: DAY, id: 'milk' })
    const first = daysReducer(plain, { type: 'added', day: DAY, todo: plants, parentId: 'milk' })
    expect(first[DAY]?.[0]).toStrictEqual({ ...milk, steps: [plants] })
  })

  it('ignores a fold of a step, of a todo without steps, or of a todo that is not there', () => {
    expect(daysReducer(withSteps, fold('lint'))).toBe(withSteps)
    expect(daysReducer(withSteps, fold('milk'))).toBe(withSteps)
    expect(daysReducer(withSteps, fold('gone'))).toBe(withSteps)
    expect(daysReducer(foldedDay, fold('lint'))).toBe(foldedDay)
    expect(daysReducer(withSteps, { type: 'foldToggled', day: '2026-09-20', id: 'ci' })).toBe(withSteps)
  })

  it('unfolds a todo when a step is added to it', () => {
    const next = daysReducer(foldedDay, { type: 'added', day: DAY, todo: plants, parentId: 'ci' })
    expect(next[DAY]).toStrictEqual([milk, { ...ci, steps: [workflow, lint, cache, plants] }])
    expect(next[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('drops the fold with the last step', () => {
    const one: DaysMap = { [DAY]: [{ ...milk, steps: [lint], folded: true }] }
    const next = daysReducer(one, { type: 'removed', day: DAY, id: 'lint' })
    expect(next[DAY]).toStrictEqual([milk])
    expect(Object.keys(next[DAY]?.[0] ?? {})).toEqual(['id', 'text', 'status'])
  })

  it('keeps the fold when a step is removed and others are left', () => {
    const next = daysReducer(foldedDay, { type: 'removed', day: DAY, id: 'lint' })
    expect(next[DAY]).toStrictEqual([milk, { ...folded, steps: [workflow, cache] }])
  })

  it('keeps the fold through done, edits and reorders, and a restored step unfolds it', () => {
    const done = daysReducer(foldedDay, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(done[DAY]?.[1]).toStrictEqual({
      ...folded,
      status: 'done',
      steps: [workflow, lint, cache].map(finished)
    })
    const reopened = daysReducer(done, { type: 'doneToggled', day: DAY, id: 'ci' })
    expect(reopened[DAY]?.[1]).toHaveProperty('folded', true)

    const stepDone = daysReducer(foldedDay, { type: 'doneToggled', day: DAY, id: 'lint' })
    expect(stepDone[DAY]?.[1]).toStrictEqual({ ...folded, steps: [workflow, finished(lint), cache] })

    const edited = daysReducer(foldedDay, { type: 'edited', day: DAY, id: 'ci', text: 'Set up the CI' })
    expect(edited[DAY]?.[1]).toStrictEqual({ ...folded, text: 'Set up the CI' })
    const stepEdited = daysReducer(foldedDay, { type: 'edited', day: DAY, id: 'lint', text: 'Fix types' })
    expect(stepEdited[DAY]?.[1]).toStrictEqual({
      ...folded,
      steps: [workflow, { ...lint, text: 'Fix types' }, cache]
    })

    const todoMoved = daysReducer(foldedDay, { type: 'placed', day: DAY, id: 'ci', beforeId: 'milk' })
    expect(todoMoved[DAY]).toStrictEqual([folded, milk])

    const removed = daysReducer(foldedDay, { type: 'removed', day: DAY, id: 'lint' })
    const restored = daysReducer(removed, {
      type: 'restored',
      day: DAY,
      todo: lint,
      index: 1,
      parentId: 'ci'
    })
    // A step is deleted while it shows, so it comes back showing.
    expect(restored).toStrictEqual(withSteps)
    expect(restored[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('moves a folded todo to another day folded, and back', () => {
    const moved = daysReducer(foldedDay, { type: 'moved', from: DAY, to: '2026-09-20', id: 'ci' })
    expect(moved).toStrictEqual({ [DAY]: [milk], '2026-09-20': [folded] })
    const back = daysReducer(moved, { type: 'moved', from: '2026-09-20', to: DAY, id: 'ci', index: 1 })
    expect(back).toStrictEqual(foldedDay)
  })

  it('brings a deleted folded todo back folded, with its steps', () => {
    const removed = daysReducer(foldedDay, { type: 'removed', day: DAY, id: 'ci' })
    expect(removed[DAY]).toStrictEqual([milk])
    expect(daysReducer(removed, { type: 'restored', day: DAY, todo: folded, index: 1 })).toStrictEqual(
      foldedDay
    )
  })

  it('changes neither the ring nor the order a day is shown in', () => {
    const done: Todo = { ...folded, status: 'done', steps: [workflow, lint, cache].map(finished) }
    const unfolded: Todo = { ...ci, status: 'done', steps: done.steps }
    expect(dayProgress([milk, done])).toEqual(dayProgress([milk, unfolded]))
    expect(dayProgress([milk, folded])).toEqual(dayProgress([milk, ci]))
    expect(resolvedIds([milk, done])).toEqual(resolvedIds([milk, unfolded]))
    expect(displayOrder([done, milk], new Set(['ci']))).toStrictEqual([milk, done])
    expect(displayOrder([folded, milk], new Set())).toStrictEqual([folded, milk])
  })
})

describe('daysReducer placing', () => {
  const TOMORROW = '2026-09-20'
  const place = (
    id: string,
    at: { parentId?: string; beforeId?: string } = {},
    day: DayKey = DAY
  ): TodoAction => ({
    type: 'placed',
    day,
    id,
    ...at
  })

  it('moves a todo by its anchor, down past several, up past several, and to the end', () => {
    const state: DaysMap = { [DAY]: [milk, taxes, plants, { ...ci, folded: true }] }
    expect(daysReducer(state, place('milk', { beforeId: 'ci' }))).toStrictEqual({
      [DAY]: [taxes, plants, milk, { ...ci, folded: true }]
    })
    // A todo takes its steps and its fold with it.
    expect(daysReducer(state, place('ci', { beforeId: 'taxes' }))).toStrictEqual({
      [DAY]: [milk, { ...ci, folded: true }, taxes, plants]
    })
    expect(daysReducer(state, place('milk'))).toStrictEqual({
      [DAY]: [taxes, plants, { ...ci, folded: true }, milk]
    })
  })

  it('places a todo among the steps of another at its anchor, and last without one', () => {
    const state: DaysMap = { [DAY]: [milk, ci, taxes] }
    // Below an unfolded todo with steps is its first step.
    expect(daysReducer(state, place('taxes', { parentId: 'ci', beforeId: 'workflow' }))).toStrictEqual({
      [DAY]: [milk, { ...ci, steps: [taxes, workflow, lint, cache] }]
    })
    expect(daysReducer(state, place('milk', { parentId: 'ci', beforeId: 'cache' }))).toStrictEqual({
      [DAY]: [{ ...ci, steps: [workflow, lint, milk, cache] }, taxes]
    })
    expect(daysReducer(state, place('taxes', { parentId: 'ci' }))).toStrictEqual({
      [DAY]: [milk, { ...ci, steps: [workflow, lint, cache, taxes] }]
    })
    expect(daysReducer({ [DAY]: [milk, taxes] }, place('milk', { parentId: 'taxes' }))).toStrictEqual({
      [DAY]: [{ ...taxes, steps: [milk] }]
    })
  })

  it('unfolds the todo it places into', () => {
    expect(
      daysReducer(
        { [DAY]: [{ ...ci, folded: true }, taxes] },
        place('taxes', { parentId: 'ci', beforeId: 'lint' })
      )
    ).toStrictEqual({ [DAY]: [{ ...ci, steps: [workflow, taxes, lint, cache] }] })
    expect(
      daysReducer({ [DAY]: [{ ...ci, folded: true }, taxes] }, place('taxes', { parentId: 'ci' }))
    ).toStrictEqual({ [DAY]: [{ ...ci, steps: [workflow, lint, cache, taxes] }] })
  })

  it('moves a step within its todo by its anchor', () => {
    const at = (id: string, beforeId?: string) =>
      daysReducer(withSteps, place(id, { parentId: 'ci', ...(beforeId === undefined ? {} : { beforeId }) }))
    expect(at('workflow', 'cache')).toStrictEqual({
      [DAY]: [milk, { ...ci, steps: [lint, workflow, cache] }]
    })
    expect(at('cache', 'workflow')).toStrictEqual({
      [DAY]: [milk, { ...ci, steps: [cache, workflow, lint] }]
    })
    expect(at('workflow')).toStrictEqual({ [DAY]: [milk, { ...ci, steps: [lint, cache, workflow] }] })
  })

  it('moves a step to another todo, and the todo it leaves keeps the rest, or loses its steps and fold', () => {
    const state: DaysMap = { [DAY]: [{ ...milk, steps: [plants], folded: true }, ci] }
    expect(daysReducer(state, place('lint', { parentId: 'milk', beforeId: 'plants' }))).toStrictEqual({
      [DAY]: [
        { ...milk, steps: [lint, plants] },
        { ...ci, steps: [workflow, cache] }
      ]
    })
    expect(daysReducer(state, place('plants', { parentId: 'ci', beforeId: 'lint' }))).toStrictEqual({
      [DAY]: [milk, { ...ci, steps: [workflow, plants, lint, cache] }]
    })
  })

  it('takes a step out to any top-level gap, before its own todo too', () => {
    const state: DaysMap = { [DAY]: [milk, ci, taxes] }
    const rest: Todo = { ...ci, steps: [workflow, cache] }
    expect(daysReducer(state, place('lint', { beforeId: 'milk' }))).toStrictEqual({
      [DAY]: [lint, milk, rest, taxes]
    })
    expect(daysReducer(state, place('lint', { beforeId: 'ci' }))).toStrictEqual({
      [DAY]: [milk, lint, rest, taxes]
    })
    expect(daysReducer(state, place('lint', { beforeId: 'taxes' }))).toStrictEqual({
      [DAY]: [milk, rest, lint, taxes]
    })
    expect(daysReducer(state, place('lint'))).toStrictEqual({ [DAY]: [milk, rest, taxes, lint] })
    expect(
      daysReducer(
        { [DAY]: [{ ...milk, steps: [plants], folded: true }, taxes] },
        place('plants', { beforeId: 'milk' })
      )
    ).toStrictEqual({ [DAY]: [plants, milk, taxes] })
  })

  it('keeps the status of a step it moves, and leaves the todo it leaves as it was', () => {
    const state: DaysMap = { [DAY]: [{ ...ci, steps: [finished(workflow), lint] }, milk] }
    expect(daysReducer(state, place('workflow', { beforeId: 'milk' }))).toStrictEqual({
      [DAY]: [{ ...ci, steps: [lint] }, finished(workflow), milk]
    })
    // Done flows down, not up: the open step leaving does not finish its todo.
    expect(daysReducer(state, place('lint'))).toStrictEqual({
      [DAY]: [{ ...ci, steps: [finished(workflow)] }, milk, lint]
    })
    expect(daysReducer(state, place('workflow', { parentId: 'milk' }))).toStrictEqual({
      [DAY]: [
        { ...ci, steps: [lint] },
        { ...milk, steps: [finished(workflow)] }
      ]
    })
  })

  it('reopens a done todo when an open row is placed into it, and leaves it done for a done one', () => {
    const done: Todo = { ...finished(ci), steps: ci.steps?.map(finished), folded: true }
    const doneSteps = [finished(workflow), finished(lint), finished(cache)]
    expect(
      daysReducer({ [DAY]: [done, milk] }, place('milk', { parentId: 'ci', beforeId: 'lint' }))
    ).toStrictEqual({
      [DAY]: [{ ...ci, steps: [finished(workflow), milk, finished(lint), finished(cache)] }]
    })
    expect(
      daysReducer({ [DAY]: [{ ...taxes, steps: [plants] }, done] }, place('plants', { parentId: 'ci' }))
    ).toStrictEqual({ [DAY]: [taxes, { ...ci, steps: [...doneSteps, plants] }] })
    expect(daysReducer({ [DAY]: [done, finished(milk)] }, place('milk', { parentId: 'ci' }))).toStrictEqual({
      [DAY]: [{ ...finished(ci), steps: [...doneSteps, finished(milk)] }]
    })
  })

  it('places by stored order, blind to which todos have settled', () => {
    // Keeping settled todos last is the display's work: a row placed before a done one goes just before it.
    const state: DaysMap = { [DAY]: [milk, finished(taxes), plants] }
    expect(daysReducer(state, place('plants', { beforeId: 'taxes' }))).toStrictEqual({
      [DAY]: [milk, plants, finished(taxes)]
    })
    expect(daysReducer(state, place('milk', { beforeId: 'plants' }))).toStrictEqual({
      [DAY]: [finished(taxes), milk, plants]
    })
  })

  it('takes a placement back with the placement it came from', () => {
    const state: DaysMap = { [DAY]: [milk, ci, taxes] }
    const back = (action: TodoAction, undo: TodoAction) => daysReducer(daysReducer(state, action), undo)
    expect(
      back(place('lint', { parentId: 'milk' }), place('lint', { parentId: 'ci', beforeId: 'cache' }))
    ).toStrictEqual(state)
    expect(back(place('taxes', { parentId: 'ci', beforeId: 'lint' }), place('taxes'))).toStrictEqual(state)
    expect(back(place('milk', { beforeId: 'taxes' }), place('milk', { beforeId: 'ci' }))).toStrictEqual(state)
  })

  it('returns the days as they were when nothing moves', () => {
    for (const action of [
      place('milk', { beforeId: 'ci' }),
      place('ci', { beforeId: 'taxes' }),
      place('taxes'),
      place('lint', { parentId: 'ci', beforeId: 'cache' }),
      place('workflow', { parentId: 'ci', beforeId: 'lint' }),
      place('cache', { parentId: 'ci' })
    ]) {
      const state: DaysMap = { [DAY]: [milk, ci, taxes] }
      expect(daysReducer(state, action), JSON.stringify(action)).toBe(state)
    }
  })

  it('refuses a placement that is not one, and returns the days as they were', () => {
    const state: DaysMap = { [DAY]: [milk, ci, taxes], [TOMORROW]: [{ ...plants, steps: [finished(milk)] }] }
    for (const action of [
      place('gone'),
      place('milk', { beforeId: 'gone' }),
      place('milk', { parentId: 'gone' }),
      // A row is never placed relative to itself.
      place('milk', { beforeId: 'milk' }),
      place('lint', { parentId: 'ci', beforeId: 'lint' }),
      place('milk', { parentId: 'milk' }),
      place('ci', { parentId: 'ci' }),
      // A todo with steps of its own is never put among steps; only a todo takes steps.
      place('ci', { parentId: 'taxes' }),
      place('ci', { parentId: 'taxes', beforeId: 'lint' }),
      place('milk', { parentId: 'lint' }),
      place('workflow', { parentId: 'lint' }),
      // The anchor is in the list the row goes to.
      place('milk', { beforeId: 'lint' }),
      place('taxes', { parentId: 'ci', beforeId: 'milk' }),
      place('lint', { parentId: 'taxes', beforeId: 'workflow' }),
      // One day at a time.
      place('taxes', { beforeId: 'plants' }),
      place('taxes', { parentId: 'plants' }),
      place('plants', {}, DAY),
      place('taxes', {}, TOMORROW),
      place('milk', {}, '2026-09-21')
    ])
      expect(daysReducer(state, action), JSON.stringify(action)).toBe(state)
  })

  it('does not mutate its input', () => {
    const state: DaysMap = { [DAY]: [{ ...ci, folded: true }, finished(taxes), { ...milk, steps: [plants] }] }
    const snapshot = structuredClone(state)
    daysReducer(state, place('taxes', { parentId: 'ci', beforeId: 'lint' }))
    daysReducer(state, place('plants', { parentId: 'ci' }))
    daysReducer(state, place('lint', { beforeId: 'ci' }))
    daysReducer(state, place('ci'))
    expect(state).toStrictEqual(snapshot)
  })
})

describe('any run of actions', () => {
  const TOMORROW = '2026-09-20'

  /** A small seeded generator (mulberry32), so a failing run can be replayed from its seed. */
  const generator = (seed: number) => (): number => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const holdsUndefined = (value: unknown): boolean =>
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).some((entry) => entry === undefined || holdsUndefined(entry))

  function broken(state: DaysMap): string[] {
    const out: string[] = []
    const ids = new Set<string>()
    for (const [day, todos] of Object.entries(state)) {
      if (todos.length === 0) out.push(`${day} is an empty entry`)
      for (const todo of todos) {
        for (const each of [todo, ...(todo.steps ?? [])]) {
          if (ids.has(each.id)) out.push(`${each.id} is there twice`)
          ids.add(each.id)
        }
        const steps = todo.steps
        if (steps?.length === 0) out.push(`${todo.id} has an empty steps list`)
        if (todo.status === 'done' && steps?.some((step) => step.status === 'open') === true)
          out.push(`${todo.id} is done with an open step`)
        if ('folded' in todo && (todo.folded !== true || steps === undefined))
          out.push(`${todo.id} has folded ${String(todo.folded)} with ${String(steps?.length ?? 0)} steps`)
        for (const step of steps ?? []) {
          if ('steps' in step || 'folded' in step || 'sticky' in step)
            out.push(`step ${step.id} has steps, a fold or a sticky`)
        }
      }
    }
    // No key holds undefined: what is saved reads back the same.
    if (holdsUndefined(state)) out.push('a key holds undefined')
    return out
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('keeps every rule over 400 actions, seed %i', (seed) => {
    const random = generator(seed)
    const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)]
    let state: DaysMap = { [DAY]: [milk, ci], [TOMORROW]: [{ ...taxes, steps: [plants] }] }
    const undos: TodoAction[] = []
    const done: string[] = []
    let made = 0
    let intos = 0
    let places = 0
    let outs = 0
    let travels = 0

    for (let i = 0; i < 400; i++) {
      const day = random() < 0.7 ? DAY : TOMORROW
      const todos = state[day] ?? []
      const every = todos.flatMap((todo) => [todo, ...(todo.steps ?? [])])
      const top = pick(todos)
      const any = pick(every)
      const fresh = (): Todo => ({ id: `new${String(made++)}`, text: 'New', status: 'open' })
      let action: TodoAction | undefined
      switch (Math.floor(random() * 14)) {
        case 0:
          action = { type: 'added', day, todo: fresh() }
          break
        case 1:
          if (top) action = { type: 'added', day, todo: fresh(), parentId: top.id }
          break
        case 2:
        case 3:
          if (any) action = { type: 'doneToggled', day, id: any.id }
          break
        case 4: {
          const found = any && locate(todos, any.id)
          if (found) {
            const { todo, index, parentId } = found
            undos.push({
              type: 'restored',
              day,
              todo,
              index,
              ...(parentId === undefined ? {} : { parentId })
            })
            action = { type: 'removed', day, id: todo.id }
          }
          break
        }
        case 5:
          action = undos.splice(Math.floor(random() * undos.length), 1)[0]
          break
        case 6: {
          const found = any && locate(todos, any.id)
          const list =
            found?.parentId === undefined ? todos : todos.find((t) => t.id === found.parentId)?.steps
          const target = list && pick(list)
          if (any && target)
            action = {
              type: 'placed',
              day,
              id: any.id,
              ...(found?.parentId === undefined ? {} : { parentId: found.parentId }),
              beforeId: target.id
            }
          break
        }
        case 7:
          if (top) action = { type: 'foldToggled', day, id: top.id }
          break
        case 8:
          if (top) {
            const to = day === DAY ? TOMORROW : DAY
            action = { type: 'moved', from: day, to, id: top.id, index: Math.floor(random() * 4) }
          }
          break
        case 9:
          if (any) action = { type: 'edited', day, id: any.id, text: `Edit ${String(i)}` }
          break
        case 10: {
          const parent = pick(todos)
          // A todo into another, as its last step.
          if (top && parent) action = { type: 'placed', day, id: top.id, parentId: parent.id }
          break
        }
        case 11: {
          // A step out, just after its todo.
          const parent = pick(todos.filter((todo) => todo.steps !== undefined))
          const step = pick(parent?.steps ?? [])
          const next = todos[todos.findIndex((todo) => todo.id === parent?.id) + 1]
          if (step) action = { type: 'placed', day, id: step.id, ...(next ? { beforeId: next.id } : {}) }
          break
        }
        case 12: {
          // Anywhere at either level, so many of these are refused.
          const parent = random() < 0.5 ? undefined : pick(todos)
          const before = pick([undefined, ...(parent === undefined ? todos : (parent.steps ?? []))])
          if (any)
            action = {
              type: 'placed',
              day,
              id: any.id,
              ...(parent === undefined ? {} : { parentId: parent.id }),
              ...(before === undefined ? {} : { beforeId: before.id })
            }
          break
        }
        case 13:
          if (top) action = { type: 'stickToggled', day, id: top.id }
          break
      }
      if (action === undefined) continue
      const before = state
      state = daysReducer(state, action)
      done.push(JSON.stringify(action))
      const problems = broken(state)
      // A step that comes back shows: its todo is unfolded.
      if (action.type === 'restored' && action.parentId !== undefined && state !== before) {
        const parent = state[action.day]?.find((todo) => todo.id === action.parentId)
        if (parent?.folded === true) problems.push(`${parent.id} is folded over a restored step`)
      }
      // A placed row is just before its anchor, or last, in the list it was put in, which shows it.
      if (action.type === 'placed' && state !== before) {
        const list = state[action.day] ?? []
        const found = locate(list, action.id)
        const target =
          action.parentId === undefined
            ? list
            : (list.find((todo) => todo.id === action.parentId)?.steps ?? [])
        if (
          found === undefined ||
          found.parentId !== action.parentId ||
          target[found.index + 1]?.id !== action.beforeId
        )
          problems.push(`${action.id} is not where it was placed`)
        if (list.find((todo) => todo.id === action.parentId)?.folded === true)
          problems.push(`${String(action.parentId)} is folded over a placed row`)
        places++
        const from = locate(before[action.day] ?? [], action.id)
        if (from?.parentId === undefined && action.parentId !== undefined) intos++
        if (from?.parentId !== undefined && action.parentId === undefined) outs++
      }
      expect(problems, `seed ${String(seed)}, after:\n${done.slice(-6).join('\n')}`).toEqual([])
      if (random() < 0.1) {
        const travelled = travel(state, TOMORROW)
        const count = (days: DaysMap) => Object.values(days).flatMap((todos) => todos).length
        const left = (state[DAY] ?? []).filter((todo) => todo.sticky !== undefined && todo.status === 'open')
        expect(broken(travelled), `seed ${String(seed)}, travel`).toEqual([])
        expect(count(travelled)).toBe(count(state))
        if (left.length === 0) expect(travelled).toBe(state)
        else expect(travelled[TOMORROW]?.slice(-left.length)).toStrictEqual(left)
        expect(travel(travelled, TOMORROW)).toBe(travelled)
        if (left.length > 0) travels++
        state = travelled
      }
    }
    // The run did reach the cases the rules are about.
    expect(done.filter((a) => a.includes('"restored"')).length).toBeGreaterThan(5)
    expect(done.filter((a) => a.includes('"foldToggled"')).length).toBeGreaterThan(5)
    expect(intos).toBeGreaterThan(5)
    expect(outs).toBeGreaterThan(5)
    expect(places).toBeGreaterThan(5)
    expect(travels).toBeGreaterThan(0)
  })

  it('keeps every rule when any row is placed at any place, and lands it there', () => {
    const since = { since: '2026-09-14' as const }
    const oats: Todo = {
      id: 'oats',
      text: 'Buy oats',
      status: 'open',
      steps: [{ ...plants, id: 'eggs' }],
      sticky: since
    }
    const settled: Todo = { ...finished(taxes), steps: [finished(plants)], folded: true }
    const state: DaysMap = { [DAY]: [{ ...milk, sticky: since }, ci, settled, oats] }
    const todos = state[DAY] ?? []
    const flat = (days: DaysMap) =>
      (days[DAY] ?? []).flatMap((todo) => [todo, ...(todo.steps ?? [])]).map((t) => t.id)
    const parents = [undefined, ...todos.map((todo) => todo.id)]
    let moves = 0
    for (const row of todos.flatMap((todo) => [todo, ...(todo.steps ?? [])])) {
      for (const parentId of parents) {
        const list =
          parentId === undefined ? todos : (todos.find((todo) => todo.id === parentId)?.steps ?? [])
        for (const beforeId of [undefined, ...list.map((entry) => entry.id)]) {
          const action: TodoAction = {
            type: 'placed',
            day: DAY,
            id: row.id,
            ...(parentId === undefined ? {} : { parentId }),
            ...(beforeId === undefined ? {} : { beforeId })
          }
          const next = daysReducer(state, action)
          const what = JSON.stringify(action)
          const moving = new Set([row, ...(row.steps ?? [])].map((each) => each.id))
          const refused =
            parentId === row.id || beforeId === row.id || (parentId !== undefined && row.steps !== undefined)
          if (refused) {
            expect(next, what).toBe(state)
            continue
          }
          expect(broken(next), what).toEqual([])
          // Nothing else moves: a todo takes its steps, and every other row keeps its order.
          expect(
            flat(next).filter((id) => !moving.has(id)),
            what
          ).toEqual(flat(state).filter((id) => !moving.has(id)))
          const found = locate(next[DAY] ?? [], row.id)
          const { sticky: _sticky, ...plain } = row
          const from = locate(todos, row.id)?.parentId
          const carried = from === undefined ? row.sticky : todos.find((todo) => todo.id === from)?.sticky
          const landed =
            parentId === undefined && carried !== undefined ? { ...plain, sticky: carried } : plain
          expect(found?.todo, what).toStrictEqual(landed)
          expect(found?.parentId, what).toBe(parentId)
          const target =
            parentId === undefined ? (next[DAY] ?? []) : (locate(next[DAY] ?? [], parentId)?.todo.steps ?? [])
          expect(target[(found?.index ?? -2) + 1]?.id, what).toBe(beforeId)
          if (next === state) continue
          moves++
          // The todo it goes into shows it.
          if (parentId !== undefined)
            expect(locate(next[DAY] ?? [], parentId)?.todo.folded, what).toBeUndefined()
        }
      }
    }
    expect(moves).toBeGreaterThan(40)
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

describe('travel', () => {
  const TODAY: DayKey = '2026-10-05'
  const MON: DayKey = '2026-10-01'
  const TUE: DayKey = '2026-10-02'
  const TOMORROW: DayKey = '2026-10-06'
  const open = (id: string, extra: Partial<Todo> = {}): Todo => ({ id, text: id, status: 'open', ...extra })
  const stuck = (id: string, since: DayKey, extra: Partial<Todo> = {}): Todo =>
    open(id, { sticky: { since }, ...extra })

  it('moves an open sticky from a past day to the end of today, and drops the day it empties', () => {
    const report = stuck('report', MON)
    const days: DaysMap = { [MON]: [report], [TODAY]: [open('milk')] }
    expect(travel(days, TODAY)).toStrictEqual({ [TODAY]: [open('milk'), report] })
  })

  it('keeps its steps, fold and start day', () => {
    const report = stuck('report', MON, {
      steps: [open('a'), { ...open('b'), status: 'done' }],
      folded: true
    })
    expect(travel({ [TUE]: [open('left'), report] }, TODAY)).toStrictEqual({
      [TUE]: [open('left')],
      [TODAY]: [report]
    })
  })

  it('moves to a today that has no entry yet', () => {
    expect(travel({ [MON]: [stuck('a', MON)] }, TODAY)).toStrictEqual({ [TODAY]: [stuck('a', MON)] })
  })

  it.each([
    ['a sticky on a future day', { [TOMORROW]: [stuck('dentist', TOMORROW)] }],
    ['a sticky already on today', { [TODAY]: [stuck('report', MON)] }],
    ['a done sticky', { [MON]: [{ ...stuck('report', MON), status: 'done' as const }] }],
    ['todos that are not sticky', { [MON]: [open('milk')], [TUE]: [open('bread')] }],
    ['no days', {}]
  ])('leaves %s alone, and hands back the same days', (_name, days: DaysMap) => {
    expect(travel(days, TODAY)).toBe(days)
  })

  it('takes past days oldest first and each in its order, after what today has', () => {
    const days: DaysMap = {
      [TUE]: [stuck('c', TUE)],
      [MON]: [stuck('a', MON), open('milk'), stuck('b', MON)],
      [TODAY]: [open('bread'), stuck('here', TODAY)]
    }
    expect(travel(days, TODAY)).toStrictEqual({
      [MON]: [open('milk')],
      [TODAY]: [open('bread'), stuck('here', TODAY), stuck('a', MON), stuck('b', MON), stuck('c', TUE)]
    })
  })

  it('changes nothing the second time', () => {
    const once = travel({ [MON]: [stuck('a', MON)], [TUE]: [stuck('b', TUE)] }, TODAY)
    expect(travel(once, TODAY)).toBe(once)
  })

  it('takes many stickies along, none lost and none doubled', () => {
    const many = Array.from({ length: 40 }, (_, i) => stuck(`s${String(i)}`, MON))
    const next = travel({ [MON]: many.slice(0, 20), [TUE]: many.slice(20) }, TODAY)
    expect(next).toStrictEqual({ [TODAY]: many })
  })

  it('does not mutate its input', () => {
    const days: DaysMap = { [MON]: [stuck('a', MON, { steps: [open('s')] })], [TODAY]: [open('b')] }
    const snapshot = structuredClone(days)
    travel(days, TODAY)
    expect(days).toStrictEqual(snapshot)
  })
})

describe('daysReducer with stickies', () => {
  const PAST: DayKey = '2026-09-17'
  const stuck = (todo: Todo, since: DayKey = DAY): Todo => ({ ...todo, sticky: { since } })
  const stick = (days: DaysMap, id: string, day: DayKey = DAY) =>
    daysReducer(days, { type: 'stickToggled', day, id })

  it('sticks a todo from the day it is on, and puts it at the end of that day', () => {
    expect(stick(days, 'milk')[DAY]).toStrictEqual([taxes, stuck(milk)])
  })

  it('unsticks it back to a normal todo at the end of the day', () => {
    const next = stick(stick({ [DAY]: [milk, taxes, plants] }, 'milk'), 'milk')
    expect(next[DAY]).toStrictEqual([taxes, plants, milk])
  })

  it('keeps steps and fold when it sticks', () => {
    const folded: Todo = { ...ci, folded: true }
    expect(stick({ [DAY]: [folded, milk] }, 'ci')[DAY]).toStrictEqual([milk, stuck(folded)])
  })

  it('ignores a step, and a todo that is not there', () => {
    expect(stick(withSteps, 'lint')).toBe(withSteps)
    expect(stick(days, 'gone')).toBe(days)
  })

  it('keeps the flag through tick, untick, edit, fold and a move', () => {
    const start: DaysMap = { [PAST]: [stuck(ci, PAST)] }
    const done = daysReducer(start, { type: 'doneToggled', day: PAST, id: 'ci' })
    expect(done[PAST]?.[0]).toMatchObject({ status: 'done', sticky: { since: PAST } })
    const back = daysReducer(done, { type: 'doneToggled', day: PAST, id: 'ci' })
    expect(back[PAST]?.[0]).toMatchObject({ status: 'open', sticky: { since: PAST } })
    const edited = daysReducer(start, { type: 'edited', day: PAST, id: 'ci', text: 'Set up CI again' })
    expect(edited[PAST]?.[0]?.sticky).toStrictEqual({ since: PAST })
    const folded = daysReducer(start, { type: 'foldToggled', day: PAST, id: 'ci' })
    expect(folded[PAST]?.[0]).toMatchObject({ folded: true, sticky: { since: PAST } })
    const moved = daysReducer(start, { type: 'moved', from: PAST, to: DAY, id: 'ci' })
    expect(moved[DAY]).toStrictEqual([stuck(ci, PAST)])
  })

  it('a sticky put under another todo is a plain step', () => {
    const next = daysReducer(
      { [DAY]: [stuck(milk), taxes] },
      { type: 'placed', day: DAY, id: 'milk', parentId: 'taxes' }
    )
    expect(next[DAY]).toStrictEqual([{ ...taxes, steps: [milk] }])
  })

  it('a step taken out of a sticky todo is sticky from the same day; out of a normal one, normal', () => {
    const fromSticky = daysReducer({ [DAY]: [stuck(ci, PAST)] }, { type: 'placed', day: DAY, id: 'lint' })
    expect(fromSticky[DAY]?.[1]).toStrictEqual(stuck(lint, PAST))
    const fromNormal = daysReducer(withSteps, { type: 'placed', day: DAY, id: 'lint' })
    expect(fromNormal[DAY]?.[2]).toStrictEqual(lint)
  })

  it('restores a deleted sticky with its flag', () => {
    const start: DaysMap = { [DAY]: [milk, stuck(taxes, PAST)] }
    const removed = daysReducer(start, { type: 'removed', day: DAY, id: 'taxes' })
    const restored = daysReducer(removed, { type: 'restored', day: DAY, todo: stuck(taxes, PAST), index: 1 })
    expect(restored).toStrictEqual(start)
  })
})

describe('dayProgress with stickies', () => {
  const sticky: Todo = { ...taxes, sticky: { since: DAY } }

  it('leaves an open sticky out of the ring', () => {
    expect(dayProgress([finished(milk), sticky])).toEqual({ resolved: 1, total: 1, cleared: true })
    expect(dayProgress([sticky])).toEqual({ resolved: 0, total: 0, cleared: false })
  })

  it('counts a done sticky like any done todo', () => {
    expect(dayProgress([milk, finished(sticky)])).toEqual({ resolved: 1, total: 2, cleared: false })
    expect(dayProgress([finished(sticky)])).toEqual({ resolved: 1, total: 1, cleared: true })
  })
})
