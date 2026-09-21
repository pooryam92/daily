import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { SCALE_STEP, flipAfterDrag, resistDrag } from './deck'
import type { DeckView } from './useDeckView'

/** How far the pointer moves before the gesture is taken for a drag or left to the list. */
const HYSTERESIS_PX = 10

/** Controls keep their own pointer behaviour. With a mouse, so does text that can be selected. */
const CONTROLS = 'input, textarea, select, button, a, label'
const SELECTABLE = '[data-selectable]'

interface Gesture {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  /** What had focus before the press took it away: usually the add-todo input. */
  readonly focused: Element | null
  /** Set once the gesture is a horizontal drag. */
  drag: {
    /** Where the pointer and the view were when the drag locked, and how many pixels make a day. */
    readonly grabX: number
    readonly origin: number
    readonly step: number
  } | null
}

export interface DeckDragHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void
}

/**
 * How many pixels the card in front travels on its way to the next position, so that it stays
 * under the pointer: the peek plus what scaling takes off one side (see `deckTransform`).
 */
function measureStep(stack: HTMLElement): number {
  const front = stack.querySelector<HTMLElement>('[data-offset="0"]')
  if (front === null) return stack.clientWidth
  // --peek is registered as a length, so its computed value is in pixels.
  const peek = Number.parseFloat(getComputedStyle(front).getPropertyValue('--peek'))
  return peek + (front.offsetWidth * SCALE_STEP) / 2
}

/**
 * Drag the deck sideways to change day. The cards follow the pointer, and nothing is decided until
 * release: past halfway or flicked, the deck flips by one day; otherwise it goes back.
 */
export function useDeckDrag(
  { view, target, settle }: DeckView,
  onFlip: (amount: -1 | 1) => void
): DeckDragHandlers {
  const gesture = useRef<Gesture | null>(null)
  const dragged = useRef(false)

  const end = (event: PointerEvent<HTMLElement>, commit: boolean): void => {
    const ended = gesture.current?.pointerId === event.pointerId ? gesture.current : null
    if (ended === null) return
    gesture.current = null
    const { drag, focused } = ended
    if (drag === null) return

    delete event.currentTarget.dataset.dragging
    // The view is in days per second; the threshold is in px/ms.
    const velocity = (view.getVelocity() * drag.step) / 1000
    const amount = commit ? flipAfterDrag(view.get() - target, velocity) : 0
    // A flip moves the target, and the deck settles on it from there (useDeckView).
    if (amount !== 0) {
      onFlip(amount)
      return
    }
    settle('drag')
    // The day stays, so typing carries on where it was. After a flip the new card takes focus itself.
    if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true })
  }

  return {
    onPointerDown: (event) => {
      dragged.current = false
      if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return
      if (event.target.closest(CONTROLS) !== null) return
      if (event.pointerType === 'mouse' && event.target.closest(SELECTABLE) !== null) return
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        focused: document.activeElement,
        drag: null
      }
    },

    onPointerMove: (event) => {
      const current = gesture.current
      if (current?.pointerId !== event.pointerId) return

      if (current.drag === null) {
        const x = Math.abs(event.clientX - current.startX)
        const y = Math.abs(event.clientY - current.startY)
        if (Math.max(x, y) < HYSTERESIS_PX) return
        // Mostly vertical: it is a scroll of the list, not a drag of the deck.
        if (y > x) {
          gesture.current = null
          return
        }
        const stack = event.currentTarget
        stack.setPointerCapture(event.pointerId)
        stack.dataset.dragging = 'true'
        dragged.current = true
        // Catch the deck where it is, also in the middle of a flip. Measuring the drag from here,
        // not from where the pointer went down, keeps the cards from jumping by the hysteresis.
        view.stop()
        current.drag = { grabX: event.clientX, origin: view.get(), step: measureStep(stack) }
      }

      const { grabX, origin, step } = current.drag
      // Dragging to the right brings the day before to the front.
      const moved = origin - (event.clientX - grabX) / step
      view.set(target + resistDrag(moved - target))
    },

    onPointerUp: (event) => {
      end(event, true)
    },

    onPointerCancel: (event) => {
      end(event, false)
    },

    // The click that ends a drag must not also select the card it ends on.
    onClickCapture: (event) => {
      if (!dragged.current) return
      dragged.current = false
      event.stopPropagation()
      event.preventDefault()
    }
  }
}
