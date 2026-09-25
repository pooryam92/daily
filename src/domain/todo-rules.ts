import type { DayKey, DaysMap, Todo } from './todo'

export type TodoAction =
  | { type: 'added'; day: DayKey; todo: Todo }
  | { type: 'doneToggled'; day: DayKey; id: string }
  | { type: 'removed'; day: DayKey; id: string }
  /** Undoes a `removed`: puts the todo back where it was. */
  | { type: 'restored'; day: DayKey; todo: Todo; index: number }
  /** Moves the todo to the place `targetId` has now, like dragging it there. */
  | { type: 'reordered'; day: DayKey; id: string; targetId: string }
  | { type: 'edited'; day: DayKey; id: string; text: string }
  /** Moves the todo to another day, at `index` there or at the end. Undo is a move back with the old index. */
  | { type: 'moved'; from: DayKey; to: DayKey; id: string; index?: number }

export function createTodo(text: string): Todo {
  return { id: crypto.randomUUID(), text, status: 'open' }
}

function withDay(days: DaysMap, day: DayKey, todos: readonly Todo[]): DaysMap {
  if (todos.length > 0) return { ...days, [day]: todos }
  // Days without todos have no entry.
  const { [day]: _removed, ...rest } = days
  return rest
}

function moveTodo(days: DaysMap, { from, to, id, index }: Extract<TodoAction, { type: 'moved' }>): DaysMap {
  const source = days[from] ?? []
  const target = days[to] ?? []
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

export function daysReducer(days: DaysMap, action: TodoAction): DaysMap {
  if (action.type === 'moved') return moveTodo(days, action)
  const todos = days[action.day] ?? []

  switch (action.type) {
    case 'added':
      return withDay(days, action.day, [...todos, action.todo])

    case 'doneToggled':
      return withDay(
        days,
        action.day,
        todos.map((todo) =>
          todo.id === action.id ? { ...todo, status: todo.status === 'done' ? 'open' : 'done' } : todo
        )
      )

    case 'removed':
      return withDay(
        days,
        action.day,
        todos.filter((todo) => todo.id !== action.id)
      )

    case 'restored': {
      // Restoring twice (two clicks on the same undo) must not duplicate the todo.
      if (todos.some((todo) => todo.id === action.todo.id)) return days
      return withDay(days, action.day, todos.toSpliced(action.index, 0, action.todo))
    }

    case 'reordered': {
      const from = todos.findIndex((todo) => todo.id === action.id)
      const to = todos.findIndex((todo) => todo.id === action.targetId)
      const moved = todos[from]
      // Both ends have to still be there: a drag can end on a todo another window has deleted.
      if (moved === undefined || to === -1 || from === to) return days
      return withDay(days, action.day, todos.toSpliced(from, 1).toSpliced(to, 0, moved))
    }

    case 'edited': {
      const index = todos.findIndex((todo) => todo.id === action.id)
      const todo = todos[index]
      if (todo === undefined || todo.text === action.text) return days
      return withDay(days, action.day, todos.with(index, { ...todo, text: action.text }))
    }
  }
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

export function dayProgress(todos: readonly Todo[]): DayProgress {
  const resolved = todos.filter((todo) => todo.status === 'done').length
  return { resolved, total: todos.length, cleared: todos.length > 0 && resolved === todos.length }
}
