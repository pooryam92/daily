import { useEffect, useState } from 'react'
import type { DayKey } from '@/domain/todo'
import { toDayKey } from '@/domain/dates'

const CHECK_INTERVAL_MS = 60_000

/** Today's day key, kept current when the app stays open past midnight. */
export function useToday(): DayKey {
  const [today, setToday] = useState(() => toDayKey(new Date()))

  useEffect(() => {
    const update = (): void => {
      setToday(toDayKey(new Date()))
    }
    const interval = setInterval(update, CHECK_INTERVAL_MS)
    // Timers are throttled while the window is in the background, so also check on focus.
    window.addEventListener('focus', update)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', update)
    }
  }, [])

  return today
}
