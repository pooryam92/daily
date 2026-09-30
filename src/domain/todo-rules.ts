import type { DayKey, DaysMap, Todo } from './todo'

export type TodoAction =
  /** Adds the todo at the end of the day, or at the end of the steps of `parentId`. */
  | { type: 'added'; day: DayKey; todo: Todo; parentId?: string }
  /** `id` is a todo or a step. Finishing a todo finishes its steps; reopening it leaves them done. */
  | { type: 'doneToggled'; day: DayKey; id: string }
  /** `id` is a todo or a step. A todo takes its steps with it. */
  | { type: 'removed'; day: DayKey; id: string }
  /** Undoes a `removed`: puts the todo back where it was, a step into the steps of `parentId`. */
  | { type: 'restored'; day: DayKey; todo: Todo; index: number; parentId?: string }
  /** Moves the todo to the place `targetId` has now, like dragging it there. Both are in the same list. */
  | { type: 'reordered'; day: DayKey; id: string; targetId: string }
  | { type: 'edited'; day: DayKey; id: string; text: string }
  /**
   * Moves the todo, with its steps, to another day, at `index` there or at the end. Undo is a move back
   * with the old index. Steps never move on their own.
   */
  | { type: 'moved'; from: DayKey; to: DayKey; id: string; index?: number }

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
  // Todos without steps have no key, so they are saved as they always were.
  const { steps: _removed, ...rest } = todo
  return rest
}

/** A list rewrite; `undefined` when it changes nothing, so the reducer can return `days` as it was. */
type ListUpdate = (list: readonly Todo[], index: number, todo: Todo) => readonly Todo[] | undefined

/** Rewrites the steps of the top-level todo `parentId`. */
function updateSteps(
  todos: readonly Todo[],
  parentId: string,
  update: (steps: readonly Todo[]) => readonly Todo[] | undefined
): readonly Todo[] | undefined {
  const index = todos.findIndex((todo) => todo.id === parentId)
  const parent = todos[index]
  if (parent === undefined) return undefined
  const steps = update(parent.steps ?? [])
  return steps === undefined ? undefined : todos.with(index, withSteps(parent, steps))
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
  return { ...todo, status: 'done', steps: todo.steps.map((step) => ({ ...step, status: 'done' })) }
}

function moveTodo(days: DaysMap, { from, to, id, index }: Extract<TodoAction, { type: 'moved' }>): DaysMap {
  const source = days[from] ?? []
  const target = days[to] ?? []
  // Only the top level is searched: a step moves with its parent, never on its own.
  const todo = source.find((entry) => entry.id === id)
  // A second click on the same undo must not duplicate the todo.
  if (todo === undefined || from === to || target.some((entry) => entry.id === id)) return days
  const at = index === undefined ? target.length : Math.min(index, target.length)
  return withDay(
    withDay(
      days,
      from,
      source.filter((entry) => entry.id !== id)
    ),
    to,
    target.toSpliced(at, 0, todo)
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
      return updateSteps(todos, parentId, (steps) => [...steps, todo])
    }

    case 'doneToggled':
      return updateListOf(todos, action.id, (list, index, todo) => list.with(index, toggled(todo)))

    case 'removed':
      return updateListOf(todos, action.id, (list, index) => list.toSpliced(index, 1))

    case 'restored': {
      const { todo, index, parentId } = action
      // Restoring twice (two clicks on the same undo) must not duplicate the todo.
      if (locate(todos, todo.id) !== undefined) return undefined
      if (parentId === undefined) return todos.toSpliced(index, 0, todo)
      return updateSteps(todos, parentId, (steps) => steps.toSpliced(index, 0, todo))
    }

    case 'reordered': {
      const moved = locate(todos, action.id)
      const target = locate(todos, action.targetId)
      // Both ends have to still be there (a drag can end on a todo another window has deleted), in one list.
      if (moved === undefined || target === undefined || moved.parentId !== target.parentId) return undefined
      if (moved.index === target.index) return undefined
      return updateListOf(todos, action.id, (list, index, todo) =>
        list.toSpliced(index, 1).toSpliced(target.index, 0, todo)
      )
    }

    case 'edited':
      return updateListOf(todos, action.id, (list, index, todo) =>
        todo.text === action.text ? undefined : list.with(index, { ...todo, text: action.text })
      )
  }
}

export function daysReducer(days: DaysMap, action: TodoAction): DaysMap {
  if (action.type === 'moved') return moveTodo(days, action)
  const todos = nextTodos(days[action.day] ?? [], action)
  return todos === undefined ? days : withDay(days, action.day, todos)
}

/**
 * The order a day is shown in: settled todos below the others, each group in the order the todos
 * are stored. `settled` is the resolved ids as they were a moment ago (see `useSettledTodos`), so a
 * todo that was only just marked, or reopened, stays under the pointer until the delay has passed.
 * Nothing but a drag (`reordered`) changes the stored order.
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

/** Counts the top-level todos only: steps do not fill the ring. */
export function dayProgress(todos: readonly Todo[]): DayProgress {
  const resolved = todos.filter((todo) => todo.status === 'done').length
  return { resolved, total: todos.length, cleared: todos.length > 0 && resolved === todos.length }
}
