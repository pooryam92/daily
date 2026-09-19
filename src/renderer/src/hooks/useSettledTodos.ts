import { useEffect, useMemo, useState } from 'react'
import type { Todo } from '@shared/todo'
import { SETTLE_DELAY_MS } from '../lib/motion'
import { displayOrder, resolvedIds } from '../lib/todos'

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

/**
 * A day's todos in display order: resolved ones settle to the bottom, but only once the list has
 * been left alone for `SETTLE_DELAY_MS`. Every change restarts the wait, so rows never move away
 * from under the pointer during a run of quick checks, and a mis-click undone in time moves nothing.
 */
export function useSettledTodos(todos: readonly Todo[]): readonly Todo[] {
  // Todos that are already resolved when the card mounts are settled from the start.
  const [settled, setSettled] = useState(() => resolvedIds(todos))

  useEffect(() => {
    const next = resolvedIds(todos)
    if (sameIds(next, settled)) return
    const timer = setTimeout(() => {
      setSettled(next)
    }, SETTLE_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [todos, settled])

  return useMemo(() => displayOrder(todos, settled), [todos, settled])
}
