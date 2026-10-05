import type { MouseEvent } from 'react'

/** How far the pointer moves after a click that took a row away before the rows' buttons answer it again. */
const GUARD_PX = 4

/** How long a tap holds the guard: a touch leaves the card as it lifts. */
const TAP_GUARD_MS = 500

/** Ends the guard that is up, if one is. */
let lift: (() => void) | null = null

/**
 * A click that takes a row away closes the rows up under a still pointer, so a second click would land on
 * the next row's button. After one, the card's row buttons hide and let clicks by (TodoItem.module.css)
 * until the pointer moves, leaves the card, or a key is pressed. Keyboard clicks set nothing.
 */
export function guardClicks(event: MouseEvent<HTMLElement>): void {
  guardFrom(event.currentTarget, event.nativeEvent)
}

/** `guardClicks` for a click React hands on as another event, as a checkbox's change. */
export function guardFrom(target: HTMLElement, click: globalThis.MouseEvent): void {
  const card = target.closest<HTMLElement>('section')
  if (card === null || click.detail === 0) return
  lift?.()
  const { clientX: x, clientY: y } = click
  const tap = click instanceof PointerEvent && (click.pointerType === 'touch' || click.pointerType === 'pen')
  let timer: number | undefined
  const move = (next: PointerEvent): void => {
    if (Math.hypot(next.clientX - x, next.clientY - y) >= GUARD_PX) end()
  }
  const end = (): void => {
    delete card.dataset.guard
    clearTimeout(timer)
    document.removeEventListener('pointermove', move, { capture: true })
    document.removeEventListener('keydown', end, { capture: true })
    card.removeEventListener('pointerleave', end)
    lift = null
  }
  card.dataset.guard = ''
  document.addEventListener('keydown', end, { capture: true })
  if (tap) {
    timer = window.setTimeout(end, TAP_GUARD_MS)
  } else {
    document.addEventListener('pointermove', move, { capture: true })
    card.addEventListener('pointerleave', end)
  }
  lift = end
}

export function guarded(event: { readonly currentTarget: Element }): boolean {
  return event.currentTarget.closest('[data-guard]') !== null
}
