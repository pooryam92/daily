import type { DayKey, DaysMap } from '@shared/todo'
import type { DayNavigation } from '../hooks/useDayNavigation'
import { useRemoveWithUndo } from '../hooks/useRemoveWithUndo'
import type { TodoActions } from '../hooks/useTodoStore'
import { addDays } from '../lib/dates'
import { DayCard } from './DayCard'
import type { StackOffset } from './DayCard'
import styles from './DayStack.module.css'

const OFFSETS: readonly StackOffset[] = [-4, -3, -2, -1, 0, 1, 2, 3, 4]

interface DayStackProps {
  readonly today: DayKey
  readonly days: DaysMap
  readonly actions: TodoActions
  readonly navigation: DayNavigation
}

export function DayStack({ today, days, actions, navigation }: DayStackProps) {
  const { current, goTo, goBy } = navigation
  const removeWithUndo = useRemoveWithUndo(days, actions)

  return (
    <div className={styles.stack}>
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
          // Keyed by day, so a card keeps its DOM node while it moves through the stack
          // and the CSS transition animates it from one position to the next.
          <DayCard
            key={day}
            day={day}
            today={today}
            offset={offset}
            todos={days[day] ?? []}
            onAdd={(text) => {
              actions.add(day, text)
            }}
            onToggleStatus={(id, status) => {
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
