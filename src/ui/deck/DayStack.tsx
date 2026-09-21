import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { DayKey, DaysMap } from '@/domain/todo'
import type { DayNavigation } from './useDayNavigation'
import { useDeckDrag } from './useDeckDrag'
import { useDeckSwipe } from './useDeckSwipe'
import { useDeckView } from './useDeckView'
import { useRemoveWithUndo } from '../todos/useRemoveWithUndo'
import { useSounds } from '../sound/useSounds'
import type { TodoActions } from '../todos/useTodoStore'
import { addDays, dayIndex } from '@/domain/dates'
import { ROW_ENTER, ROW_EXIT } from '../lib/motion'
import { DayCard } from '../day/DayCard'
import type { StackOffset } from '../day/DayCard'
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

  // Which arrow leads to today, once the deck has left it.
  const away = dayIndex(today) - dayIndex(current)
  const towardsToday = away === 0 ? null : away < 0 ? 'previous' : 'next'

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
        <ChevronLeft size={28} aria-hidden="true" />
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
            onEdit={(id, text) => {
              actions.edit(day, id, text)
            }}
            onReorder={(id, targetId) => {
              actions.reorder(day, id, targetId)
            }}
            onSelect={() => {
              goTo(day)
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
        <ChevronRight size={28} aria-hidden="true" />
      </button>

      {/* The way back to today, over the middle of the deck: it belongs to the deck and not to a day,
          and it is one flip from any distance. Its arrow says which way that flip goes. */}
      <AnimatePresence initial={false}>
        {towardsToday !== null && (
          <motion.button
            type="button"
            className={styles.today}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: ROW_ENTER }}
            exit={{ opacity: 0, transition: ROW_EXIT }}
            onClick={() => {
              goTo(today)
            }}
          >
            {towardsToday === 'previous' && <ArrowLeft size={14} aria-hidden="true" />}
            Back to today
            {towardsToday === 'next' && <ArrowRight size={14} aria-hidden="true" />}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
