import { useCallback } from 'react'
import { toast } from 'sonner'
import type { DayKey, DaysMap } from '@/domain/todo'
import { locate } from '@/domain/todo-rules'
import { UNDO_WINDOW_MS } from '../lib/motion'
import type { TodoActions } from './useTodoStore'

/**
 * Deleting is immediate and never asks for confirmation; instead a toast offers to undo it for a
 * few seconds. The todo is really gone (and saved as gone) in the meantime, so closing the app
 * during the undo window cannot bring it back by accident. A step comes back into its parent; if
 * the parent has been deleted since, there is nothing to put it back into, and undo does nothing.
 */
export function useRemoveWithUndo(days: DaysMap, actions: TodoActions): (day: DayKey, id: string) => void {
  return useCallback(
    (day, id) => {
      const found = locate(days[day] ?? [], id)
      if (found === undefined) return
      const { todo, index, parentId } = found

      actions.remove(day, id)
      toast(parentId === undefined ? 'Todo deleted' : 'Step deleted', {
        description: todo.text,
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            actions.restore(day, todo, index, parentId)
          }
        }
      })
    },
    [days, actions]
  )
}
