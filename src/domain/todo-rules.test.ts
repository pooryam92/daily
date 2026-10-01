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

  it('reopens a done todo when the delete of an open step under it is undone, and keeps its fold', () => {
    const removed = daysReducer(withSteps, { type: 'removed', day: DAY, id: 'lint' })
    const done = daysReducer(removed, { type: 'doneToggled', day: DAY, id: 'ci' })
    const undo = { type: 'restored', day: DAY, todo: lint, index: 1, parentId: 'ci' } as const
    const steps = [finished(workflow), lint, finished(cache)]
    expect(daysReducer(done, undo)[DAY]?.[1]).toStrictEqual({ ...ci, steps, folded: true })
    const unfolded = daysReducer(daysReducer(done, fold('ci')), undo)
    expect(unfolded[DAY]?.[1]).toStrictEqual({ ...ci, steps })
    expect(unfolded[DAY]?.[1]).not.toHaveProperty('folded')
  })

  it('keeps a done todo done when a done step is restored under it', () => {
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
      steps: [workflow, lint, cache].map(finished),
      folded: true
    })
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

  it('keeps the fold through done, edits, reorders and restores', () => {
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

    const stepMoved = daysReducer(foldedDay, {
      type: 'reordered',
      day: DAY,
      id: 'cache',
      targetId: 'workflow'
    })
    expect(stepMoved[DAY]?.[1]).toStrictEqual({ ...folded, steps: [cache, workflow, lint] })
    const todoMoved = daysReducer(foldedDay, { type: 'reordered', day: DAY, id: 'ci', targetId: 'milk' })
    expect(todoMoved[DAY]).toStrictEqual([folded, milk])

    const removed = daysReducer(foldedDay, { type: 'removed', day: DAY, id: 'lint' })
    const restored = daysReducer(removed, {
      type: 'restored',
      day: DAY,
      todo: lint,
      index: 1,
      parentId: 'ci'
    })
    expect(restored).toStrictEqual(foldedDay)
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

  /** What must hold after every action; each broken rule is named. */
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
          if ('steps' in step || 'folded' in step) out.push(`step ${step.id} has steps or a fold`)
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

    for (let i = 0; i < 400; i++) {
      const day = random() < 0.7 ? DAY : TOMORROW
      const todos = state[day] ?? []
      const every = todos.flatMap((todo) => [todo, ...(todo.steps ?? [])])
      const top = pick(todos)
      const any = pick(every)
      const fresh = (): Todo => ({ id: `new${String(made++)}`, text: 'New', status: 'open' })
      let action: TodoAction | undefined
      switch (Math.floor(random() * 10)) {
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
          if (any && target) action = { type: 'reordered', day, id: any.id, targetId: target.id }
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
      }
      if (action === undefined) continue
      state = daysReducer(state, action)
      done.push(JSON.stringify(action))
      expect(broken(state), `seed ${String(seed)}, after:\n${done.slice(-6).join('\n')}`).toEqual([])
    }
    // The run did reach the cases the rules are about.
    expect(done.filter((a) => a.includes('"restored"')).length).toBeGreaterThan(5)
    expect(done.filter((a) => a.includes('"foldToggled"')).length).toBeGreaterThan(5)
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
