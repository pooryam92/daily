import type { DayKey, DaysMap, ResolvedStatus, Todo } from '@shared/todo'

export type TodoAction =
  | { type: 'added'; day: DayKey; todo: Todo }
  | { type: 'statusToggled'; day: DayKey; id: string; status: ResolvedStatus }
  | { type: 'removed'; day: DayKey; id: string }
  /** Undoes a `removed`: puts the todo back where it was. */
  | { type: 'restored'; day: DayKey; todo: Todo; index: number }

export function createTodo(text: string): Todo {
  return { id: crypto.randomUUID(), text, status: 'open' }
}

function withDay(days: DaysMap, day: DayKey, todos: readonly Todo[]): DaysMap {
  if (todos.length > 0) return { ...days, [day]: todos }
  // Days without todos have no entry.
  const { [day]: _removed, ...rest } = days
  return rest
}

export function daysReducer(days: DaysMap, action: TodoAction): DaysMap {
  const todos = days[action.day] ?? []

  switch (action.type) {
    case 'added':
      return withDay(days, action.day, [...todos, action.todo])

    case 'statusToggled':
      return withDay(
        days,
        action.day,
        todos.map((todo) =>
          todo.id === action.id
            ? // Marking a todo with the status it already has reopens it.
              { ...todo, status: todo.status === action.status ? 'open' : action.status }
            : todo
        )
      )

    case 'removed':
      return withDay(
        days,
        action.day,
        todos.filter((todo) => todo.id !== action.id)
      )

    case 'restored':
      // Restoring twice (two clicks on the same undo) must not duplicate the todo.
      if (todos.some((todo) => todo.id === action.todo.id)) return days
      return withDay(days, action.day, todos.toSpliced(action.index, 0, action.todo))
  }
}

/**
 * The order a day is shown in: settled todos below the others, each group in the order the todos
 * were added. `settled` is the resolved ids as they were a moment ago (see `useSettledTodos`), so a
 * todo that was only just marked, or reopened, stays under the pointer until the delay has passed.
 * The stored order never changes.
 */
export function displayOrder(todos: readonly Todo[], settled: ReadonlySet<string>): readonly Todo[] {
  return [...todos.filter((todo) => !settled.has(todo.id)), ...todos.filter((todo) => settled.has(todo.id))]
}

/** The ids of the todos that are done or dropped. */
export function resolvedIds(todos: readonly Todo[]): ReadonlySet<string> {
  return new Set(todos.filter((todo) => todo.status !== 'open').map((todo) => todo.id))
}

export interface DayProgress {
  readonly resolved: number
  readonly total: number
  /** Nothing is left open. A day without todos is empty, not cleared. */
  readonly cleared: boolean
}

/**
 * How far along a day is. A dropped todo counts like a done one: deciding against a todo closes it
 * too, and progress that left drops out would understate how little is left.
 */
export function dayProgress(todos: readonly Todo[]): DayProgress {
  const resolved = todos.filter((todo) => todo.status !== 'open').length
  return { resolved, total: todos.length, cleared: todos.length > 0 && resolved === todos.length }
}
