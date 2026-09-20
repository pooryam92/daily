import { useEffect, useMemo, useReducer, useRef } from 'react'
import { STORE_VERSION } from '@shared/todo'
import type { DayKey, DaysMap, ResolvedStatus, Todo } from '@shared/todo'
import { toMessage } from '../lib/errors'
import { createTodo, daysReducer } from '../lib/todos'
import type { TodoAction } from '../lib/todos'

export interface TodoActions {
  readonly add: (day: DayKey, text: string) => void
  readonly toggleStatus: (day: DayKey, id: string, status: ResolvedStatus) => void
  readonly remove: (day: DayKey, id: string) => void
  /** Puts a removed todo back at `index` of its day. */
  readonly restore: (day: DayKey, todo: Todo, index: number) => void
  /** Moves a todo to the place the todo it was dropped on has now. */
  readonly reorder: (day: DayKey, id: string, targetId: string) => void
  readonly edit: (day: DayKey, id: string, text: string) => void
}

type State =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed'; readonly error: string }
  | { readonly phase: 'ready'; readonly days: DaysMap; readonly saveError: string | null }

type Action =
  | { type: 'loaded'; days: DaysMap }
  | { type: 'loadFailed'; error: string }
  | { type: 'saveSettled'; error: string | null }
  | TodoAction

export type TodoStore = State & { readonly actions: TodoActions }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { phase: 'ready', days: action.days, saveError: null }
    case 'loadFailed':
      return { phase: 'failed', error: action.error }
    case 'saveSettled':
      if (state.phase !== 'ready' || state.saveError === action.error) return state
      return { ...state, saveError: action.error }
    default:
      if (state.phase !== 'ready') return state
      return { ...state, days: daysReducer(state.days, action) }
  }
}

/** The todos of all days: loaded from disk on mount, saved back on every change. */
export function useTodoStore(): TodoStore {
  const [state, dispatch] = useReducer(reducer, { phase: 'loading' })
  // What is on disk, to tell real changes apart from the initial load.
  const persisted = useRef<DaysMap | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.store.load().then(
      ({ days }) => {
        if (cancelled) return
        persisted.current = days
        dispatch({ type: 'loaded', days })
      },
      (error: unknown) => {
        if (!cancelled) dispatch({ type: 'loadFailed', error: toMessage(error) })
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const days = state.phase === 'ready' ? state.days : null
  useEffect(() => {
    if (days === null || days === persisted.current) return
    persisted.current = days
    window.api.store.save({ version: STORE_VERSION, days }).then(
      () => {
        dispatch({ type: 'saveSettled', error: null })
      },
      (error: unknown) => {
        dispatch({ type: 'saveSettled', error: toMessage(error) })
      }
    )
  }, [days])

  const actions = useMemo<TodoActions>(
    () => ({
      add: (day, text) => {
        dispatch({ type: 'added', day, todo: createTodo(text) })
      },
      toggleStatus: (day, id, status) => {
        dispatch({ type: 'statusToggled', day, id, status })
      },
      remove: (day, id) => {
        dispatch({ type: 'removed', day, id })
      },
      restore: (day, todo, index) => {
        dispatch({ type: 'restored', day, todo, index })
      },
      reorder: (day, id, targetId) => {
        dispatch({ type: 'reordered', day, id, targetId })
      },
      edit: (day, id, text) => {
        dispatch({ type: 'edited', day, id, text })
      }
    }),
    []
  )

  return { ...state, actions }
}
