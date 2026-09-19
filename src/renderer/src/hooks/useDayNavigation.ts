import { useCallback, useEffect, useState } from 'react'
import type { DayKey } from '@shared/todo'
import { addDays } from '../lib/dates'

export interface DayNavigation {
  /** The day whose card is in front. */
  readonly current: DayKey
  readonly goTo: (day: DayKey) => void
  readonly goBy: (amount: number) => void
}

export function useDayNavigation(today: DayKey): DayNavigation {
  // `null` means "following today", so the view moves along when midnight passes.
  const [selected, setSelected] = useState<DayKey | null>(null)

  const goTo = useCallback(
    (day: DayKey) => {
      setSelected(day === today ? null : day)
    },
    [today]
  )

  const goBy = useCallback(
    (amount: number) => {
      setSelected((previous) => {
        const day = addDays(previous ?? today, amount)
        return day === today ? null : day
      })
    },
    [today]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      // Leave the arrow keys alone while there is text to move the cursor through.
      if (event.target instanceof HTMLInputElement && event.target.value !== '') return
      goBy(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [goBy])

  return { current: selected ?? today, goTo, goBy }
}
