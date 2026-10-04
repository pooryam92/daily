import { STORE_VERSION } from './store'
import type { StoreData } from './store'
import { TODO_STATUSES } from './todo'
import type { DayKey, Todo, TodoStatus } from './todo'

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const isDayKey = (value: string): value is DayKey => DAY_KEY_PATTERN.test(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTodoStatus = (value: unknown): value is TodoStatus =>
  typeof value === 'string' && (TODO_STATUSES as readonly string[]).includes(value)

/** Until 1.2.0 a todo could be dropped; that state now reads as done. */
const statusOf = (value: unknown): unknown => (value === 'dropped' ? 'done' : value)

function parseTodo(value: unknown, parentId?: string): Todo {
  if (!isRecord(value)) throw new TypeError('A todo must be an object')
  const { id, text } = value
  const status = statusOf(value.status)
  if (typeof id !== 'string' || id === '') throw new TypeError('A todo must have an id')
  if (typeof text !== 'string') throw new TypeError(`Todo ${id} must have a text`)
  if (!isTodoStatus(status)) throw new TypeError(`Todo ${id} has an unknown status`)
  const steps = parseSteps(value.steps, id, parentId)
  // No key rather than an empty list, so a todo without steps is saved as it always was.
  if (steps.length === 0) return { id, text, status }
  // A fold hides steps, so it is kept only where there are some (never on a step), and only as `true`.
  return value.folded === true ? { id, text, status, steps, folded: true } : { id, text, status, steps }
}

function parseSteps(value: unknown, id: string, parentId: string | undefined): readonly Todo[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new TypeError(`Steps of todo ${id} must be a list`)
  // Steps go one level deep. The type allows more, so lifting that later changes this and not the file.
  if (parentId !== undefined && value.length > 0)
    throw new TypeError(`Todo ${id} is a step and cannot have steps`)
  return (value as unknown[]).map((step) => parseTodo(step, id))
}

/**
 * Validates data that crossed a trust boundary (the file on disk, an IPC message)
 * and returns it as `StoreData`. Throws a `TypeError` if it has the wrong shape.
 */
export function parseStoreData(value: unknown): StoreData {
  if (!isRecord(value)) throw new TypeError('Store data must be an object')

  const rawDays = value.days ?? {}
  if (!isRecord(rawDays)) throw new TypeError('Store data "days" must be an object')

  const days: Record<DayKey, Todo[]> = {}
  for (const [key, todos] of Object.entries(rawDays)) {
    if (!isDayKey(key)) throw new TypeError(`Invalid day key: ${key}`)
    if (!Array.isArray(todos)) throw new TypeError(`Todos of ${key} must be a list`)
    days[key] = (todos as unknown[]).map((todo) => parseTodo(todo))
  }

  return { version: STORE_VERSION, days }
}
