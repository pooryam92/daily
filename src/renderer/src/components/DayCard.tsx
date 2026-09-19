import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import type { DayKey, ResolvedStatus, Todo } from '@shared/todo'
import { useSettledTodos } from '../hooks/useSettledTodos'
import { formatDay, relativeLabel } from '../lib/dates'
import { QUICK_ADD_MS } from '../lib/motion'
import { AddTodoForm } from './AddTodoForm'
import styles from './DayCard.module.css'
import { TodoItem } from './TodoItem'

/** Position in the stack: 0 is the card in front, ±1 peek out behind it, ±2 are off-stage. */
export type StackOffset = -2 | -1 | 0 | 1 | 2

interface DayCardProps {
  readonly day: DayKey
  readonly today: DayKey
  readonly offset: StackOffset
  readonly todos: readonly Todo[]
  readonly onAdd: (text: string) => void
  readonly onToggleStatus: (id: string, status: ResolvedStatus) => void
  readonly onRemove: (id: string) => void
  /** Bring this card to the front. */
  readonly onSelect: () => void
  readonly onBackToToday: () => void
}

export function DayCard({
  day,
  today,
  offset,
  todos,
  onAdd,
  onToggleStatus,
  onRemove,
  onSelect,
  onBackToToday
}: DayCardProps) {
  const inFront = offset === 0
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
    <section
      className={styles.card}
      data-offset={offset}
      data-today={day === today}
      aria-hidden={!inFront}
      onClick={inFront ? undefined : onSelect}
    >
      <div className={styles.content} inert={!inFront}>
        <header className={styles.header}>
          <div>
            <span className={styles.relative}>{relativeLabel(day, today)}</span>
            <h1 className={styles.title}>{formatDay(day)}</h1>
          </div>
          {inFront && day !== today && (
            <button type="button" className={styles.backToToday} onClick={onBackToToday}>
              Back to today
            </button>
          )}
        </header>

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

        {inFront && <AddTodoForm onAdd={add} />}
      </div>
    </section>
  )
}
