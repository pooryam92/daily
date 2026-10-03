import type { MouseEvent } from 'react'

/** How far the pointer moves after a click that took a row away before the rows' buttons answer it again. */
const GUARD_PX = 4

/** Ends the guard that is up, if one is. */
let lift: (() => void) | null = null

/**
 * A click that takes a row away (moving it, deleting it) closes the rows up under a still pointer, and
 * a second click, a double click's say, would land on the button of the row that took its place. So
 * after one, the card's row buttons are hidden and let clicks by (TodoItem.module.css) until the
 * pointer moves 4px, leaves the card, or a key is pressed. The keyboard's own clicks set nothing.
 */
export function guardClicks(event: MouseEvent<HTMLElement>): void {
  const card = event.currentTarget.closest<HTMLElement>('section')
  if (card === null || event.detail === 0) return
  lift?.()
  const { clientX: x, clientY: y } = event
  const move = (next: PointerEvent): void => {
    if (Math.hypot(next.clientX - x, next.clientY - y) >= GUARD_PX) end()
  }
  const end = (): void => {
    delete card.dataset.guard
    document.removeEventListener('pointermove', move, { capture: true })
    document.removeEventListener('keydown', end, { capture: true })
    card.removeEventListener('pointerleave', end)
    lift = null
  }
  card.dataset.guard = ''
  document.addEventListener('pointermove', move, { capture: true })
  document.addEventListener('keydown', end, { capture: true })
  card.addEventListener('pointerleave', end)
  lift = end
}

/** Whether a click on a row button is one the guard lets by. */
export function guarded(event: MouseEvent<HTMLElement>): boolean {
  return event.currentTarget.closest('[data-guard]') !== null
}
