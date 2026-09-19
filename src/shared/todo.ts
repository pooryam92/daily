export const TODO_STATUSES = ['open', 'done', 'dropped'] as const

export type TodoStatus = (typeof TODO_STATUSES)[number]

/** A status a todo can be marked with; marking it again puts it back to `open`. */
export type ResolvedStatus = Exclude<TodoStatus, 'open'>

export interface Todo {
  readonly id: string
  readonly text: string
  readonly status: TodoStatus
}

/** A calendar day in local time, formatted as `YYYY-MM-DD`. */
export type DayKey = `${number}-${number}-${number}`

/** Todos per day. Days without todos have no entry. */
export type DaysMap = Readonly<Record<DayKey, readonly Todo[]>>

export const STORE_VERSION = 1

/** The shape of the file the todos are persisted in. */
export interface StoreData {
  readonly version: typeof STORE_VERSION
  readonly days: DaysMap
}

export const EMPTY_STORE: StoreData = { version: STORE_VERSION, days: {} }
