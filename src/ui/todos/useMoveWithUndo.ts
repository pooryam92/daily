import { useCallback } from 'react'
import { toast } from 'sonner'
import type { DayKey, DaysMap } from '@/domain/todo'
import type { MoveTarget } from '../day/copy'
import { UNDO_WINDOW_MS } from '../lib/motion'
import type { TodoActions } from './useTodoStore'

/**
 * A move is as immediate as a delete and gets the same undo: the toast names the day, Undo puts the
 * todo back where it was. Nothing records that it moved.
 */
export function useMoveWithUndo(
  days: DaysMap,
  actions: TodoActions
): (from: DayKey, target: MoveTarget, id: string) => void {
  return useCallback(
    (from, target, id) => {
      const todos = days[from] ?? []
      const index = todos.findIndex((todo) => todo.id === id)
      const todo = todos[index]
      if (todo === undefined) return

      actions.move(from, target.day, id)
      toast(`Moved to ${target.name}`, {
        description: todo.text,
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            actions.move(target.day, from, id, index)
          }
        }
      })
    },
    [days, actions]
  )
}
