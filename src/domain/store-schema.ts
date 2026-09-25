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

function noteOf(id: string, value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw new TypeError(`Todo ${id} has a note that is not a string`)
  return value
}

function parseTodo(value: unknown): Todo {
  if (!isRecord(value)) throw new TypeError('A todo must be an object')
  const { id, text } = value
  const status = statusOf(value.status)
  if (typeof id !== 'string' || id === '') throw new TypeError('A todo must have an id')
  if (typeof text !== 'string') throw new TypeError(`Todo ${id} must have a text`)
  if (!isTodoStatus(status)) throw new TypeError(`Todo ${id} has an unknown status`)
  const note = noteOf(id, value.note)
  return note === undefined ? { id, text, status } : { id, text, status, note }
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
    days[key] = (todos as unknown[]).map(parseTodo)
  }

  return { version: STORE_VERSION, days }
}
