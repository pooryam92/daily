export const TODO_STATUSES = ['open', 'done'] as const

export type TodoStatus = (typeof TODO_STATUSES)[number]

export interface Todo {
  readonly id: string
  readonly text: string
  readonly status: TodoStatus
  /** One level of todos under this one; `parseStoreData` enforces the depth. No key means none. */
  readonly steps?: readonly Todo[]
  /** Its steps are hidden, by choice. No key means they show; only a todo with steps has it. */
  readonly folded?: true
}

/** A calendar day in local time, formatted as `YYYY-MM-DD`. */
export type DayKey = `${number}-${number}-${number}`

/** Todos per day. Days without todos have no entry. */
export type DaysMap = Readonly<Record<DayKey, readonly Todo[]>>
