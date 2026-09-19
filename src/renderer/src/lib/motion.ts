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

/** A row moving to its new place. A spring keeps its velocity when the target changes mid-flight. */
export const ROW_LAYOUT: Transition = { type: 'spring', duration: 0.4, bounce: 0 }

export const ROW_ENTER: Transition = { duration: BASE, ease: EASE_OUT }
export const ROW_EXIT: Transition = { duration: FAST, ease: EASE_OUT }

/** The pill of a segmented control sliding to the chosen segment. */
export const SEGMENT: Transition = { type: 'spring', duration: 0.3, bounce: 0 }

/** How long a marked (or reopened) todo stays in place, so a mis-click can be undone before it moves. */
export const SETTLE_DELAY_MS = 700

/** Todos added faster than this after the previous one appear without the entry animation. */
export const QUICK_ADD_MS = 1000

/** How long the undo toast of a deleted todo stays. */
export const UNDO_WINDOW_MS = 6000
