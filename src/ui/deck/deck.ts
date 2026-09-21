/*
 * The geometry of the day deck. A card's position is how many days it is from the front: 0 is in
 * front, ±1 sit behind it, further out is off-stage. It is a continuous number, because cards
 * travel between the whole positions during a flip or a drag. The reasoning is in docs/design.md.
 */

/** How much smaller a card gets per step away from the front. */
export const SCALE_STEP = 0.08

/** The furthest a drag takes the deck; past it the deck resists. One flip per drag. */
const DRAG_LIMIT = 1
/** The constant of the usual rubber-band curve. */
const RUBBER_BAND = 0.55
/** The most the deck gives past the limit, in days. */
const RUBBER_BAND_REACH = 0.5

/** Dragged at least this far, in days, a release flips. It is also where two cards swap places in depth. */
const FLIP_DISTANCE = 0.5
/** A release faster than this, in px/ms, flips whatever the distance (Sonner's threshold). */
const FLICK_VELOCITY = 0.11

/**
 * The whole transform as one string, so every frame writes a single property. --peek is how far
 * the day before and the day after stick out; it depends on the window (DayStack.module.css).
 */
export function deckTransform(position: number): string {
  const scale = 1 - SCALE_STEP * Math.abs(position)
  // Scaling takes (1 - scale) / 2 of the width off each side; add that back, plus what should show.
  const shrink = position * SCALE_STEP * 50
  const out = Math.max(-1, Math.min(position, 1))
  return `translateX(calc(${String(shrink)}% + ${String(out)} * var(--peek))) scale(${String(scale)})`
}

/** The card nearest the front is on top; two cards swap places halfway between two positions. */
export function deckZIndex(position: number): number {
  return 4 - Math.round(Math.abs(position))
}

/** How far a drag of `days` moves the deck: 1 to 1 up to the limit, then less and less. */
export function resistDrag(days: number): number {
  const over = Math.abs(days) - DRAG_LIMIT
  if (over <= 0) return days
  const give = (over * RUBBER_BAND_REACH * RUBBER_BAND) / (RUBBER_BAND_REACH + RUBBER_BAND * over)
  return Math.sign(days) * (DRAG_LIMIT + give)
}

/**
 * Which way a released drag flips the deck: past halfway, or flicked. `dragged` is how far the
 * deck is from the day in front, in days; `velocity` is in px/ms along the same axis. A flick back
 * against the drag cancels it.
 */
export function flipAfterDrag(dragged: number, velocity: number): -1 | 0 | 1 {
  const direction = Math.sign(dragged) as -1 | 0 | 1
  const along = velocity * direction
  if (along < -FLICK_VELOCITY) return 0
  return Math.abs(dragged) >= FLIP_DISTANCE || along > FLICK_VELOCITY ? direction : 0
}
