import type { Transition } from 'motion/react'

/*
 * Timings for the animations that run in Motion instead of CSS. The durations and the curve mirror
 * the motion tokens in styles/global.css; keep the two in sync. The reasoning is in docs/DESIGN.md §5.
 */

/** `--ease-out` */
export const EASE_OUT = [0.2, 0, 0, 1] as const

/** `--duration-fast`, in seconds. */
const FAST = 0.12
/** `--duration-base`, in seconds. */
const BASE = 0.2

/**
 * Checking: the box fills, then the check is drawn; 280ms in total, well inside the 400ms budget.
 * Unchecking runs the other way round and faster, because leaving should never outlast arriving.
 */
export const CHECK = {
  fill: {
    on: { duration: FAST, ease: EASE_OUT },
    off: { duration: FAST, ease: EASE_OUT, delay: 0.08 }
  },
  draw: {
    on: { duration: 0.18, ease: EASE_OUT, delay: 0.1 },
    off: { duration: 0.1, ease: EASE_OUT }
  }
} as const satisfies Record<string, Record<'on' | 'off', Transition>>

/** The arc of the progress ring following the day's todos. */
export const RING: Transition = { type: 'spring', duration: 0.5, bounce: 0 }

/**
 * Clearing the day, the app's one flourish. It does not block anything, so it may take longer than
 * the 400ms budget: the arc closes (`RING`), the ring dips and then fills, pops and sends out a
 * halo, the check is drawn, and the header line says so. About 0.9s in all, then the card rests.
 * Reopening runs the other way round and faster, like the checkbox.
 */
export const CLEARED = {
  /** How long the arc gets to close before the ring turns into the check. */
  fill: {
    on: { duration: FAST, ease: EASE_OUT, delay: 0.25 },
    off: { duration: FAST, ease: EASE_OUT, delay: 0.08 }
  },
  draw: {
    on: { duration: 0.18, ease: EASE_OUT, delay: 0.33 },
    off: { duration: 0.1, ease: EASE_OUT }
  },
  /** "A big action needs a big wind-up": a dip while the arc closes, a pop as the ring fills. */
  pop: { duration: 0.6, times: [0, 0.4, 0.62, 1], ease: EASE_OUT },
  halo: { duration: 0.7, ease: EASE_OUT, delay: 0.25 },
  label: {
    on: { duration: BASE, ease: EASE_OUT, delay: 0.45 },
    off: { duration: FAST, ease: EASE_OUT }
  }
} as const satisfies Record<string, Transition | Record<'on' | 'off', Transition>>

/** The empty-day line waits for the row that was deleted last to fade out. */
export const EMPTY_ENTER: Transition = { duration: BASE, ease: EASE_OUT, delay: FAST }

/** A row moving to its new place. A spring keeps its velocity when the target changes mid-flight. */
export const ROW_LAYOUT: Transition = { type: 'spring', duration: 0.4, bounce: 0 }

export const ROW_ENTER: Transition = { duration: BASE, ease: EASE_OUT }
export const ROW_EXIT: Transition = { duration: FAST, ease: EASE_OUT }

/** The pill of a segmented control sliding to the chosen segment. */
export const SEGMENT: Transition = { type: 'spring', duration: 0.3, bounce: 0 }

/**
 * A spring in Apple's terms: `response` is roughly how long it takes, in seconds; a `dampingRatio` of 1
 * does not overshoot. It is spelled out as stiffness and damping because Motion starts a spring that
 * is given as a duration from rest, and a flip has to keep the speed the deck already has.
 */
const spring = (response: number, dampingRatio: number): Transition => ({
  type: 'spring',
  stiffness: ((2 * Math.PI) / response) ** 2,
  damping: (4 * Math.PI * dampingRatio) / response,
  mass: 1,
  // The deck moves in days, and a day is a few hundred pixels: come to rest within a fraction of one.
  restDelta: 0.001,
  restSpeed: 0.01
})

/** What flipped the deck. How often it happens decides how much motion it gets. */
export type FlipSource = 'key' | 'held-key' | 'pointer' | 'drag'

/**
 * A day flip. Arrow keys are used all the time, so they are quick, and instant while held down.
 * A click gets the full spring, 95% there in 260ms and at rest inside the 400ms budget. Only a
 * released drag overshoots a little, because it arrives with the hand's speed.
 */
export const FLIP: Record<FlipSource, Transition | null> = {
  key: spring(0.15, 1),
  'held-key': null,
  pointer: spring(0.35, 1),
  drag: spring(0.35, 0.85)
}

/** How long a marked (or reopened) todo stays in place, so a mis-click can be undone before it moves. */
export const SETTLE_DELAY_MS = 700

/** Todos added faster than this after the previous one appear without the entry animation. */
export const QUICK_ADD_MS = 1000

/** How long the undo toast of a deleted todo stays. */
export const UNDO_WINDOW_MS = 6000
