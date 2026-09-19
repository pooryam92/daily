import { useEffect, useRef } from 'react'
import type { DayKey, DaysMap } from '@shared/todo'
import type { DayNavigation } from '../hooks/useDayNavigation'
import { useDeckDrag } from '../hooks/useDeckDrag'
import { useDeckSwipe } from '../hooks/useDeckSwipe'
import { useDeckView } from '../hooks/useDeckView'
import { useRemoveWithUndo } from '../hooks/useRemoveWithUndo'
import { useSounds } from '../hooks/useSounds'
import type { TodoActions } from '../hooks/useTodoStore'
import { addDays } from '../lib/dates'
import { DayCard } from './DayCard'
import type { StackOffset } from './DayCard'
import styles from './DayStack.module.css'

/*
 * Only ±1 show next to the card in front. The cards further out are invisible: they are there so
 * that a day is already in place when a flip, or a drag pulled past its limit, brings it into view.
 */
const OFFSETS: readonly StackOffset[] = [-3, -2, -1, 0, 1, 2, 3]

interface DayStackProps {
  readonly today: DayKey
  readonly days: DaysMap
  readonly actions: TodoActions
  readonly navigation: DayNavigation
  /** Whether marking a todo makes a sound. */
  readonly sound: boolean
}

export function DayStack({ today, days, actions, navigation, sound }: DayStackProps) {
  const { current, source, goTo, goBy } = navigation
  const removeWithUndo = useRemoveWithUndo(days, actions)
  const playMark = useSounds(sound)

  const stack = useRef<HTMLDivElement>(null)
  const deck = useDeckView(current, source)
  const drag = useDeckDrag(deck, (amount) => {
    goBy(amount, 'drag')
  })
  useDeckSwipe(stack, goBy)

  // Tells the cards when the deck is travelling (DayCard.module.css); a drag marks itself.
  const { view } = deck
  useEffect(() => {
    const setMoving = (moving: boolean) => (): void => {
      stack.current?.toggleAttribute('data-moving', moving)
    }
    const subscriptions = [
      view.on('animationStart', setMoving(true)),
      view.on('animationComplete', setMoving(false)),
      view.on('animationCancel', setMoving(false))
    ]
    return () => {
      subscriptions.forEach((unsubscribe) => {
        unsubscribe()
      })
    }
  }, [view])

  return (
    <div ref={stack} className={styles.stack} {...drag}>
      <button
        type="button"
        className={styles.nav}
        data-direction="previous"
        aria-label="Previous day"
        onClick={() => {
          goBy(-1)
        }}
      >
        ‹
      </button>

      {OFFSETS.map((offset) => {
        const day = addDays(current, offset)
        return (
          // Keyed by day, so a card keeps its DOM node, and its list its scroll position, while it
          // moves through the stack.
          <DayCard
            key={day}
            day={day}
            today={today}
            offset={offset}
            view={view}
            todos={days[day] ?? []}
            onAdd={(text) => {
              actions.add(day, text)
            }}
            onToggleStatus={(id, status) => {
              playMark(days[day] ?? [], id, status)
              actions.toggleStatus(day, id, status)
            }}
            onRemove={(id) => {
              removeWithUndo(day, id)
            }}
            onSelect={() => {
              goTo(day)
            }}
            onBackToToday={() => {
              goTo(today)
            }}
          />
        )
      })}

      <button
        type="button"
        className={styles.nav}
        data-direction="next"
        aria-label="Next day"
        onClick={() => {
          goBy(1)
        }}
      >
        ›
      </button>
    </div>
  )
}
