import { useCallback, useEffect, useState } from 'react'
import type { DayKey } from '@shared/todo'
import { addDays } from '../lib/dates'
import type { FlipSource } from '../lib/motion'

export interface DayNavigation {
  /** The day whose card is in front. */
  readonly current: DayKey
  /** What brought that day to the front: it decides how the deck moves there. */
  readonly source: FlipSource
  readonly goTo: (day: DayKey, source?: FlipSource) => void
  readonly goBy: (amount: number, source?: FlipSource) => void
}

interface Selection {
  /** `null` means "following today", so the view moves along when midnight passes. */
  readonly day: DayKey | null
  readonly source: FlipSource
}

export function useDayNavigation(today: DayKey): DayNavigation {
  const [selection, setSelection] = useState<Selection>({ day: null, source: 'pointer' })

  const goTo = useCallback(
    (day: DayKey, source: FlipSource = 'pointer') => {
      setSelection({ day: day === today ? null : day, source })
    },
    [today]
  )

  const goBy = useCallback(
    (amount: number, source: FlipSource = 'pointer') => {
      setSelection((previous) => {
        const day = addDays(previous.day ?? today, amount)
        return { day: day === today ? null : day, source }
      })
    },
    [today]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest('[data-todo-handle]') !== null) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      // Leave the arrow keys alone while there is text to move the cursor through: a todo being
      // edited always has some, the add-todo input only once something has been typed into it.
      if (event.target instanceof HTMLTextAreaElement) return
      if (event.target instanceof HTMLInputElement && event.target.value !== '') return
      goBy(event.key === 'ArrowLeft' ? -1 : 1, event.repeat ? 'held-key' : 'key')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [goBy])

  return { current: selection.day ?? today, source: selection.source, goTo, goBy }
}
