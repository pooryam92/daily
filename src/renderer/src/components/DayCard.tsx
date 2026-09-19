import { AnimatePresence, motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import type { DayKey, ResolvedStatus, Todo } from '@shared/todo'
import { useSettledTodos } from '../hooks/useSettledTodos'
import { CLEARED_LABEL, emptyDayLine } from '../lib/copy'
import { dayIndex, formatDay, formatWeekday, fromDayKey, relativeLabel } from '../lib/dates'
import { deckTransform, deckZIndex } from '../lib/deck'
import { CLEARED, EMPTY_ENTER, QUICK_ADD_MS, ROW_ENTER, ROW_EXIT } from '../lib/motion'
import { dayProgress } from '../lib/todos'
import { AddTodoForm } from './AddTodoForm'
import styles from './DayCard.module.css'
import { ProgressRing } from './ProgressRing'
import { TodoItem } from './TodoItem'

/**
 * The card's place in the deck once it is at rest: 0 is in front, ±1 sit behind it, the rest are
 * off-stage. Where the card is drawn follows `view`, which travels between those places.
 */
export type StackOffset = -3 | -2 | -1 | 0 | 1 | 2 | 3

interface DayCardProps {
  readonly day: DayKey
  readonly today: DayKey
  readonly offset: StackOffset
  /** Where the deck is looking, as a day index; see `useDeckView`. */
  readonly view: MotionValue<number>
  readonly todos: readonly Todo[]
  readonly onAdd: (text: string) => void
  readonly onToggleStatus: (id: string, status: ResolvedStatus) => void
  readonly onRemove: (id: string) => void
  /** Bring this card to the front. */
  readonly onSelect: () => void
  readonly onBackToToday: () => void
}

/** A todo's bar in the glance is short, medium or long, like its text. */
const glanceLength = (text: string): 'short' | 'medium' | 'long' =>
  text.length < 16 ? 'short' : text.length < 36 ? 'medium' : 'long'

export function DayCard({
  day,
  today,
  offset,
  view,
  todos,
  onAdd,
  onToggleStatus,
  onRemove,
  onSelect,
  onBackToToday
}: DayCardProps) {
  const inFront = offset === 0

  // From frame to frame only transform and opacity change, which need neither layout nor paint
  // (z-index changes once per flip, where two cards swap).
  const index = dayIndex(day)
  const position = useTransform(view, (latest) => index - latest)
  const transform = useTransform(position, deckTransform)
  const zIndex = useTransform(position, deckZIndex)
  const opacity = useTransform(position, [-2, -1, 1, 2], [0, 1, 1, 0])
  // Depth is a tint towards the background (62% and 38% surface), and only the card in front is lifted.
  const shade = useTransform(position, [-2, -1, 0, 1, 2], [0.62, 0.38, 0, 0.38, 0.62])
  const lift = useTransform(position, [-1, 0, 1], [0, 1, 0])
  // The real content and the stand-in take turns, and neither shows at the halfway point where two
  // cards swap: a card arrives on top blank and fills in, instead of two layouts showing through each other.
  const content = useTransform(position, [-0.5, 0, 0.5], [0, 1, 0])
  const standIn = useTransform(position, [-1, -0.5, 0.5, 1], [1, 0, 0, 1])

  // Which side of the deck the card was on last. The card in front keeps it, so that its stand-in
  // fades out where it was instead of jumping to the other edge.
  const [side, setSide] = useState<'before' | 'after'>(offset < 0 ? 'before' : 'after')
  if (offset !== 0 && side !== (offset < 0 ? 'before' : 'after')) setSide(offset < 0 ? 'before' : 'after')

  const label = relativeLabel(day, today)
  const progress = useMemo(() => dayProgress(todos), [todos])
  const ordered = useSettledTodos(todos)
  const order = ordered.map((todo) => todo.id).join()

  // Todos that were there when the card mounted are not new: they neither animate in nor scroll.
  const [initialIds] = useState(() => new Set(todos.map((todo) => todo.id)))
  // Animating every row of a quick run of additions would be noise, so only the first one does.
  const [animateEnter, setAnimateEnter] = useState(true)
  const lastAddedAt = useRef(Number.NEGATIVE_INFINITY)
  const add = (text: string): void => {
    const now = performance.now()
    setAnimateEnter(now - lastAddedAt.current > QUICK_ADD_MS)
    lastAddedAt.current = now
    onAdd(text)
  }

  return (
    // A card in the background is one big click target. That is a shortcut for mouse users only:
    // the arrow buttons and arrow keys do the same, so it needs no keyboard handling of its own.
    <motion.section
      className={styles.card}
      style={{ transform, zIndex, opacity }}
      data-offset={offset}
      data-side={side}
      data-today={day === today}
      aria-hidden={!inFront}
      onClick={inFront ? undefined : onSelect}
    >
      <motion.div className={styles.lift} style={{ opacity: lift }} />
      <motion.div className={styles.shade} style={{ opacity: shade }} />
      {/* What a card shows while it is behind, laid out in the strip the card in front leaves visible.
          The real header and list are hidden then: they are covered on one side or the other. */}
      <motion.div className={styles.behind} style={{ opacity: standIn }} aria-hidden>
        <div className={styles.tab}>
          <span className={styles.tabWeekday}>{formatWeekday(day)}</span>
          <span className={styles.tabDate}>{fromDayKey(day).getDate()}</span>
          {progress.total > 0 && (
            <span className={styles.tabRing}>
              <ProgressRing progress={progress} size="sm" />
            </span>
          )}
        </div>
        <ul className={styles.glance}>
          {ordered.map((todo) => (
            <li
              key={todo.id}
              className={styles.glanceBar}
              data-status={todo.status}
              data-length={glanceLength(todo.text)}
            />
          ))}
        </ul>
      </motion.div>
      <motion.div className={styles.content} style={{ opacity: content }} inert={!inFront}>
        <header className={styles.header}>
          <div>
            {/* Where the day stands: which day it is, how far along, and whether anything is left.
                A day without todos has no ring, because there is nothing to be part-way through. */}
            <div className={styles.status}>
              {label !== null && <span className={styles.relative}>{label}</span>}
              <AnimatePresence initial={false}>
                {progress.total > 0 && (
                  <motion.span
                    key="ring"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: ROW_ENTER }}
                    exit={{ opacity: 0, transition: ROW_EXIT }}
                  >
                    <ProgressRing progress={progress} />
                  </motion.span>
                )}
              </AnimatePresence>
              {/* A live region has to be there before its text is, or the text is not announced. */}
              <span role="status">
                <AnimatePresence initial={false}>
                  {progress.cleared && (
                    <motion.span
                      className={styles.cleared}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0, transition: CLEARED.label.on }}
                      exit={{ opacity: 0, transition: CLEARED.label.off }}
                    >
                      {CLEARED_LABEL}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
            <h1 className={styles.title}>{formatDay(day)}</h1>
          </div>
          {inFront && day !== today && (
            <button type="button" className={styles.backToToday} onClick={onBackToToday}>
              Back to today
            </button>
          )}
        </header>

        <div className={styles.body}>
          <AnimatePresence initial={false}>
            {todos.length === 0 && (
              <motion.p
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: EMPTY_ENTER }}
                exit={{ opacity: 0, transition: ROW_EXIT }}
              >
                {emptyDayLine(day, today)}
              </motion.p>
            )}
          </AnimatePresence>

          {/* `layoutScroll` lets the rows' layout animations account for how far the list is scrolled. */}
          <motion.ul className={styles.todos} layoutScroll>
            {/* `popLayout` takes a deleted row out of the flow at once, so the rows below close the gap
                while it fades instead of jumping up afterwards. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {ordered.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  order={order}
                  isNew={!initialIds.has(todo.id)}
                  animateEnter={animateEnter}
                  onToggleStatus={onToggleStatus}
                  onRemove={onRemove}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        </div>

        {inFront && <AddTodoForm onAdd={add} />}
      </motion.div>
    </motion.section>
  )
}
