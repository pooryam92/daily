import { useCallback } from 'react'
import type { ResolvedStatus, Todo } from '@shared/todo'
import { cueFor, play } from '../lib/sound'

/**
 * Plays the sound of a click on a todo's mark, if sound is switched on. It is called with the day's
 * todos as they are before the click, which is what decides whether this click clears the day.
 */
export function useSounds(
  enabled: boolean
): (todos: readonly Todo[], id: string, status: ResolvedStatus) => void {
  return useCallback(
    (todos, id, status) => {
      if (!enabled) return
      const cue = cueFor(todos, id, status)
      if (cue !== null) play(cue)
    },
    [enabled]
  )
}
