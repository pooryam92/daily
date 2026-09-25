import { useCallback } from 'react'
import type { Todo } from '@/domain/todo'
import { cueFor, play } from './sound'

/**
 * Plays the sound of a click on a todo's box, if sound is switched on. It is called with the day's
 * todos as they are before the click, which is what decides whether this click clears the day.
 */
export function useSounds(enabled: boolean): (todos: readonly Todo[], id: string) => void {
  return useCallback(
    (todos, id) => {
      if (!enabled) return
      const cue = cueFor(todos, id)
      if (cue !== null) play(cue)
    },
    [enabled]
  )
}
