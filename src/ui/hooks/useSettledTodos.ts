import { useEffect, useMemo, useState } from 'react'
import type { Todo } from '@/domain/todo'
import { SETTLE_DELAY_MS } from '../lib/motion'
import { displayOrder, resolvedIds } from '@/domain/todo-rules'

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

export interface SettledTodos {
  readonly ordered: readonly Todo[]
  /** The ids of the todos that are shown below the others. */
  readonly settled: ReadonlySet<string>
}

/**
 * A day's todos in display order: resolved ones settle to the bottom, but only once the list has
 * been left alone for `SETTLE_DELAY_MS`. Every change restarts the wait, so rows never move away
 * from under the pointer during a run of quick checks, and a mis-click undone in time moves nothing.
 * `held` stops the wait altogether: while a row is being dragged, nothing else may move the list.
 */
export function useSettledTodos(todos: readonly Todo[], held = false): SettledTodos {
  // Todos that are already resolved when the card mounts are settled from the start.
  const [settled, setSettled] = useState(() => resolvedIds(todos))

  useEffect(() => {
    if (held) return
    const next = resolvedIds(todos)
    if (sameIds(next, settled)) return
    const timer = setTimeout(() => {
      setSettled(next)
    }, SETTLE_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [todos, settled, held])

  const ordered = useMemo(() => displayOrder(todos, settled), [todos, settled])
  return { ordered, settled }
}
