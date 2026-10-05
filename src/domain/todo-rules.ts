import { compareDays } from './dates'
import type { DayKey, DaysMap, Todo } from './todo'

export type TodoAction =
  /** Adds the todo at the end of the day, or at the end of the steps of `parentId`. */
  | { type: 'added'; day: DayKey; todo: Todo; parentId?: string }
  /**
   * `id` is a todo or a step. Finishing a todo finishes its steps and folds them; reopening it leaves
   * them done, and folded. Reopening a step under a done todo reopens the todo.
   */
  | { type: 'doneToggled'; day: DayKey; id: string }
  /** `id` is a todo or a step. A todo takes its steps with it. */
  | { type: 'removed'; day: DayKey; id: string }
  /**
   * Undoes a `removed`: puts the todo back where it was, a step into the steps of `parentId`, which
   * unfolds to show it again. A todo keeps its own fold.
   */
  | { type: 'restored'; day: DayKey; todo: Todo; index: number; parentId?: string }
  | { type: 'edited'; day: DayKey; id: string; text: string }
  /** Hides the steps of the todo `id`, or shows them again. A step, or a todo without steps, has none. */
  | { type: 'foldToggled'; day: DayKey; id: string }
  /**
   * Puts the todo or step `id` before `beforeId` (else at the end) in the steps of `parentId`, or in the
   * day's todos: how a drag drops a row. The todo it goes under unfolds, one that loses its last step loses
   * its fold, and a todo with steps of its own never goes under another.
   */
  | { type: 'placed'; day: DayKey; id: string; parentId?: string; beforeId?: string }
  /**
   * Moves the todo, with its steps, to another day, at `index` there or at the end. Undo is a move back
   * with the old index. Steps never move on their own.
   */
  | { type: 'moved'; from: DayKey; to: DayKey; id: string; index?: number }
  /** Sticks the todo `id` from `day` on, or unsticks it; either way it goes to the end of the day's list. */
  | { type: 'stickToggled'; day: DayKey; id: string }

export function createTodo(text: string): Todo {
  return { id: crypto.randomUUID(), text, status: 'open' }
}

/** Finds a todo or a step by id; `index` is its place in its own list (the day's, or its parent's steps). */
export function locate(
  todos: readonly Todo[],
  id: string
): { todo: Todo; index: number; parentId: string | undefined } | undefined {
  const index = todos.findIndex((todo) => todo.id === id)
  const todo = todos[index]
  if (todo !== undefined) return { todo, index, parentId: undefined }
  for (const parent of todos) {
    const steps = parent.steps ?? []
    const at = steps.findIndex((step) => step.id === id)
    const step = steps[at]
    if (step !== undefined) return { todo: step, index: at, parentId: parent.id }
  }
  return undefined
}

/** How many of the todo's steps are done, out of how many (0/0 without steps). */
export function stepProgress(todo: Todo): { done: number; total: number } {
  const steps = todo.steps ?? []
  return { done: steps.filter((step) => step.status === 'done').length, total: steps.length }
}

function withDay(days: DaysMap, day: DayKey, todos: readonly Todo[]): DaysMap {
  if (todos.length > 0) return { ...days, [day]: todos }
  // Days without todos have no entry.
  const { [day]: _removed, ...rest } = days
  return rest
}

function withSteps(todo: Todo, steps: readonly Todo[]): Todo {
  if (steps.length > 0) return { ...todo, steps }
  // Todos without steps have no key, so they are saved as they always were; nor is there anything to fold.
  const { steps: _removed, ...rest } = todo
  return unfolded(rest)
}

function unfolded(todo: Todo): Todo {
  const { folded: _removed, ...rest } = todo
  return rest
}

function unstuck(todo: Todo): Todo {
  const { sticky: _removed, ...rest } = todo
  return rest
}

/** Open and sticky: carried to today, and outside the day's ring. */
export const isCarried = (todo: Todo): boolean => todo.sticky !== undefined && todo.status === 'open'

/** A list rewrite; `undefined` when it changes nothing, so the reducer can return `days` as it was. */
type ListUpdate = (list: readonly Todo[], index: number, todo: Todo) => readonly Todo[] | undefined

/** Rewrites the steps of the top-level todo `parentId`, and with `reshape`, the todo itself. */
function updateSteps(
  todos: readonly Todo[],
  parentId: string,
  update: (steps: readonly Todo[]) => readonly Todo[] | undefined,
  reshape: (parent: Todo) => Todo = (parent) => parent
): readonly Todo[] | undefined {
  const index = todos.findIndex((todo) => todo.id === parentId)
  const parent = todos[index]
  if (parent === undefined) return undefined
  const steps = update(parent.steps ?? [])
  return steps === undefined ? undefined : todos.with(index, withSteps(reshape(parent), steps))
}

/** Rewrites the list that holds `id`, the day's own or its parent's steps, and returns the day's list. */
function updateListOf(todos: readonly Todo[], id: string, update: ListUpdate): readonly Todo[] | undefined {
  const found = locate(todos, id)
  if (found === undefined) return undefined
  const { index, todo, parentId } = found
  if (parentId === undefined) return update(todos, index, todo)
  return updateSteps(todos, parentId, (steps) => update(steps, index, todo))
}

function toggled(todo: Todo): Todo {
  // Reopening leaves the steps done: nothing says which of them were open before.
  if (todo.status === 'done') return { ...todo, status: 'open' }
  // Done flows down, not up: finishing a todo finishes its steps, but finishing its steps leaves it open.
  if (todo.steps === undefined) return { ...todo, status: 'done' }
  // A finished todo is one line until its steps are asked for.
  return {
    ...todo,
    status: 'done',
    steps: todo.steps.map((step) => ({ ...step, status: 'done' })),
    folded: true
  }
}

/**
 * The parent `step` is put under, as it must be then: no done todo has an open step, so one that
 * gets one is open again. Not done flows up, where done does not. Its fold stays as it was.
 */
const holding =
  (step: Todo) =>
  (parent: Todo): Todo =>
    step.status === 'open' && parent.status === 'done' ? { ...parent, status: 'open' } : parent

/** Puts `step` at `index` in the steps of `parentId` (at the end without one), unfolding the parent to show it. */
function insertStep(
  todos: readonly Todo[],
  parentId: string,
  index: number | undefined,
  step: Todo
): readonly Todo[] | undefined {
  return updateSteps(
    todos,
    parentId,
    (steps) => steps.toSpliced(index ?? steps.length, 0, step),
    (parent) => holding(step)(unfolded(parent))
  )
}

function moveTodo(days: DaysMap, { from, to, id, index }: Extract<TodoAction, { type: 'moved' }>): DaysMap {
  const source = days[from] ?? []
  const target = days[to] ?? []
  // Only the top level is searched: a step moves with its parent, never on its own.
  const todo = source.find((entry) => entry.id === id)
  // A second click on the same undo must not duplicate the todo.
  if (todo === undefined || from === to || target.some((entry) => entry.id === id)) return days
  const at = index === undefined ? target.length : Math.min(index, target.length)
  // A sticky's age never starts after a day it has been on.
  const moved =
    todo.sticky !== undefined && compareDays(to, todo.sticky.since) < 0
      ? { ...todo, sticky: { since: to } }
      : todo
  return withDay(
    withDay(
      days,
      from,
      source.filter((entry) => entry.id !== id)
    ),
    to,
    target.toSpliced(at, 0, moved)
  )
}

function nextTodos(
  todos: readonly Todo[],
  action: Exclude<TodoAction, { type: 'moved' }>
): readonly Todo[] | undefined {
  switch (action.type) {
    case 'added': {
      const { todo, parentId } = action
      if (parentId === undefined) return [...todos, todo]
      // A step is added to be seen: a folded todo opens for it.
      return insertStep(todos, parentId, undefined, todo)
    }

    case 'doneToggled': {
      const found = locate(todos, action.id)
      if (found === undefined) return undefined
      const { index, parentId } = found
      const todo = toggled(found.todo)
      if (parentId === undefined) return todos.with(index, todo)
      return updateSteps(todos, parentId, (steps) => steps.with(index, todo), holding(todo))
    }

    case 'removed':
      return updateListOf(todos, action.id, (list, index) => list.toSpliced(index, 1))

    case 'restored': {
      const { todo, index, parentId } = action
      // Restoring twice (two clicks on the same undo) must not duplicate the todo.
      if (locate(todos, todo.id) !== undefined) return undefined
      if (parentId === undefined) return todos.toSpliced(index, 0, todo)
      // A step is deleted while it shows, so it comes back showing.
      return insertStep(todos, parentId, index, todo)
    }

    case 'edited':
      return updateListOf(todos, action.id, (list, index, todo) =>
        todo.text === action.text ? undefined : list.with(index, { ...todo, text: action.text })
      )

    case 'foldToggled': {
      // Only the top level is searched: a step has no steps of its own.
      const index = todos.findIndex((todo) => todo.id === action.id)
      const todo = todos[index]
      if (todo?.steps === undefined) return undefined
      return todos.with(index, todo.folded === true ? unfolded(todo) : { ...todo, folded: true })
    }

    case 'placed':
      return place(todos, action)

    case 'stickToggled': {
      // Only the top level is searched: a step travels with its todo.
      const index = todos.findIndex((todo) => todo.id === action.id)
      const todo = todos[index]
      if (todo === undefined) return undefined
      const toggled = todo.sticky === undefined ? { ...todo, sticky: { since: action.day } } : unstuck(todo)
      return [...todos.toSpliced(index, 1), toggled]
    }
  }
}

/** Where `placed` puts a row; `undefined` when it cannot go there, or would stay where it was. */
function place(
  todos: readonly Todo[],
  { id, parentId, beforeId }: Extract<TodoAction, { type: 'placed' }>
): readonly Todo[] | undefined {
  const found = locate(todos, id)
  if (found === undefined || parentId === id || beforeId === id) return undefined
  const { todo } = found
  if (parentId !== undefined && todo.steps !== undefined) return undefined
  const rest =
    found.parentId === undefined
      ? todos.toSpliced(found.index, 1)
      : updateSteps(todos, found.parentId, (steps) => steps.toSpliced(found.index, 1))
  if (rest === undefined) return undefined
  // Only a todo is searched for the parent, so a step cannot become one.
  const parent = rest.find((entry) => entry.id === parentId)
  if (parentId !== undefined && parent === undefined) return undefined
  const list = parentId === undefined ? rest : (parent?.steps ?? [])
  // The row it goes before has to still be there (another window may have deleted it), in that list.
  const index = beforeId === undefined ? list.length : list.findIndex((entry) => entry.id === beforeId)
  if (index === -1 || (parentId === found.parentId && index === found.index)) return undefined
  // A done step comes out a done todo, and its todo keeps its status: done does not flow up.
  if (parentId === undefined) return rest.toSpliced(index, 0, outOf(todos, found.parentId, todo))
  return insertStep(rest, parentId, index, unstuck(todo))
}

/** A step taken out of a sticky todo stays in the sticky list, so it becomes sticky too. */
function outOf(todos: readonly Todo[], parentId: string | undefined, step: Todo): Todo {
  const sticky = todos.find((todo) => todo.id === parentId)?.sticky
  return sticky === undefined ? step : { ...step, sticky }
}

function restoreDay(days: DaysMap, { day, parentId }: Extract<TodoAction, { type: 'restored' }>): DayKey {
  if (parentId === undefined || days[day]?.some((todo) => todo.id === parentId) === true) return day
  const keys = Object.keys(days) as DayKey[]
  return keys.find((key) => days[key]?.some((todo) => todo.id === parentId) === true) ?? day
}

/**
 * Carries every open sticky todo on a day before `today` to the end of today's list, oldest day first.
 * Returns `days` itself when there is nothing to carry.
 */
export function travel(days: DaysMap, today: DayKey): DaysMap {
  const past = (Object.keys(days) as DayKey[])
    .filter((key) => compareDays(key, today) < 0 && days[key]?.some(isCarried) === true)
    .sort(compareDays)
  if (past.length === 0) return days
  let next = days
  const carried: Todo[] = []
  for (const key of past) {
    const todos = days[key] ?? []
    carried.push(...todos.filter(isCarried))
    next = withDay(
      next,
      key,
      todos.filter((todo) => !isCarried(todo))
    )
  }
  return withDay(next, today, [...(next[today] ?? []), ...carried])
}

export function daysReducer(days: DaysMap, action: TodoAction): DaysMap {
  if (action.type === 'moved') return moveTodo(days, action)
  const day = action.type === 'restored' ? restoreDay(days, action) : action.day
  const todos = nextTodos(days[day] ?? [], action)
  return todos === undefined ? days : withDay(days, day, todos)
}

/**
 * The order a day is shown in: settled todos below the others, each group in the order the todos
 * are stored. `settled` is the resolved ids as they were a moment ago (see `useSettledTodos`), so a
 * todo that was only just marked, or reopened, stays under the pointer until the delay has passed.
 * Nothing but a drag (`placed`) changes the stored order.
 */
export function displayOrder(todos: readonly Todo[], settled: ReadonlySet<string>): readonly Todo[] {
  return [...todos.filter((todo) => !settled.has(todo.id)), ...todos.filter((todo) => settled.has(todo.id))]
}

export function resolvedIds(todos: readonly Todo[]): ReadonlySet<string> {
  return new Set(todos.filter((todo) => todo.status === 'done').map((todo) => todo.id))
}

export interface DayProgress {
  readonly resolved: number
  readonly total: number
  /** Nothing is left open. A day without todos is empty, not cleared. */
  readonly cleared: boolean
}

/** Counts the top-level todos only: steps do not fill the ring, nor do open sticky todos. */
export function dayProgress(all: readonly Todo[]): DayProgress {
  const todos = all.filter((todo) => !isCarried(todo))
  const resolved = todos.filter((todo) => todo.status === 'done').length
  return { resolved, total: todos.length, cleared: todos.length > 0 && resolved === todos.length }
}
