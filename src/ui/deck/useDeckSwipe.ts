import { useEffect, useEffectEvent } from 'react'
import type { RefObject } from 'react'
import { WheelGestures } from 'wheel-gestures'

/** How far a swipe has to travel before it flips the deck. */
const SWIPE_DISTANCE_PX = 90
/** How much more sideways than vertical a swipe has to be, so that scrolling a list never flips the deck. */
const SIDEWAYS_RATIO = 1.3

/**
 * A two-finger sideways swipe on the trackpad flips the deck, once per gesture. Chromium does not
 * say which wheel events are momentum, so a plain sum of deltaX would flip several days per swipe;
 * wheel-gestures tells a gesture's start, its momentum tail and its end apart.
 */
export function useDeckSwipe(stack: RefObject<HTMLElement | null>, onFlip: (amount: -1 | 1) => void): void {
  const flip = useEffectEvent(onFlip)

  useEffect(() => {
    const element = stack.current
    if (element === null) return

    // Only sideways wheel events are taken from the page; vertical ones still scroll the list.
    const gestures = WheelGestures({ preventWheelAction: 'x' })
    let flipped = false
    gestures.on('wheel', ({ isStart, isMomentum, axisMovement: [x, y] }) => {
      if (isStart) flipped = false
      if (flipped || isMomentum) return
      if (Math.abs(x) < SWIPE_DISTANCE_PX || Math.abs(x) < Math.abs(y) * SIDEWAYS_RATIO) return
      flipped = true
      // The swipe points at the day it goes to, as the arrow keys do, and not the way a drag pulls
      // the card: to the right brings the day after.
      flip(x > 0 ? 1 : -1)
    })
    gestures.observe(element)

    return () => {
      gestures.disconnect()
    }
  }, [stack])
}
