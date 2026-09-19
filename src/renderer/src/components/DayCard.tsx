import type { DayKey, ResolvedStatus, Todo } from '@shared/todo'
import { formatDay, relativeLabel } from '../lib/dates'
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

        <ul className={styles.todos}>
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onToggleStatus={onToggleStatus} onRemove={onRemove} />
          ))}
        </ul>

        {inFront && <AddTodoForm onAdd={onAdd} />}
      </div>
    </section>
  )
}
