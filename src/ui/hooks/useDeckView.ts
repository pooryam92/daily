import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useCallback, useLayoutEffect } from 'react'
import type { DayKey } from '@/domain/todo'
import { dayIndex } from '@/domain/dates'
import { FLIP } from '../lib/motion'
import type { FlipSource } from '../lib/motion'

export interface DeckView {
  /**
   * Where the deck is looking, as a day index (`dayIndex`). Whole numbers are days; in between, the
   * deck is travelling. Every card places itself by its distance from this one value.
   */
  readonly view: MotionValue<number>
  /** The index of the day in front, which is where the view comes to rest. */
  readonly target: number
  /** Send the view to the day in front, moving the way `source` calls for. */
  readonly settle: (source: FlipSource) => void
}

export function useDeckView(current: DayKey, source: FlipSource): DeckView {
  const target = dayIndex(current)
  const view = useMotionValue(target)
  const reducedMotion = useReducedMotion()

  const settle = useCallback(
    (source: FlipSource) => {
      const transition = FLIP[source]
      // The sliding, scaling stack is vestibular-trigger motion: under reduced motion cards move instantly.
      if (transition === null || reducedMotion === true) {
        // Not `view.jump`: that lands in the commit that mounts the new cards, and in development
        // StrictMode's second mount makes them miss it. An animation lands on the next frame.
        animate(view, target, { duration: 0 })
        return
      }
      // Only the cards around the day in front exist, so the view never trails it by more than one
      // day: a jump from far away ("Back to today") arrives as one flip from the right side.
      const behind = target - view.get()
      if (Math.abs(behind) > 1) view.jump(target - Math.sign(behind))
      // A spring starts from the value's current velocity, so a flip can be retargeted mid-flight.
      animate(view, target, transition)
    },
    [view, target, reducedMotion]
  )

  // A layout effect, so that cards mounted for a far jump are never painted before the view has moved.
  useLayoutEffect(() => {
    settle(source)
    // Only a change of day moves the deck; `source` is read along with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return { view, target, settle }
}
