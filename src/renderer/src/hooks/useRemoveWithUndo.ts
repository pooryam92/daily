import { useCallback } from 'react'
import { toast } from 'sonner'
import type { DayKey, DaysMap } from '@shared/todo'
import { UNDO_WINDOW_MS } from '../lib/motion'
import type { TodoActions } from './useTodoStore'

/**
 * Deleting is immediate and never asks for confirmation; instead a toast offers to undo it for a
 * few seconds. The todo is really gone (and saved as gone) in the meantime, so closing the app
 * during the undo window cannot bring it back by accident.
 */
export function useRemoveWithUndo(days: DaysMap, actions: TodoActions): (day: DayKey, id: string) => void {
  return useCallback(
    (day, id) => {
      const todos = days[day] ?? []
      const index = todos.findIndex((todo) => todo.id === id)
      const todo = todos[index]
      if (todo === undefined) return

      actions.remove(day, id)
      toast('Todo deleted', {
        description: todo.text,
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            actions.restore(day, todo, index)
          }
        }
      })
    },
    [days, actions]
  )
}
