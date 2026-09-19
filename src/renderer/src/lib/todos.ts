import type { DayKey, DaysMap, ResolvedStatus, Todo } from '@shared/todo'

export type TodoAction =
  | { type: 'added'; day: DayKey; todo: Todo }
  | { type: 'statusToggled'; day: DayKey; id: string; status: ResolvedStatus }
  | { type: 'removed'; day: DayKey; id: string }

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
  }
}
