import type { ResolvedStatus, Todo } from '@shared/todo'
import styles from './TodoItem.module.css'

const MARKS = [
  { status: 'done', label: 'Done', symbol: '✓' },
  { status: 'dropped', label: 'Dropped', symbol: '✗' }
] as const satisfies readonly { status: ResolvedStatus; label: string; symbol: string }[]

interface TodoItemProps {
  readonly todo: Todo
  readonly onToggleStatus: (id: string, status: ResolvedStatus) => void
  readonly onRemove: (id: string) => void
}

export function TodoItem({ todo, onToggleStatus, onRemove }: TodoItemProps) {
  return (
    <li className={styles.todo} data-status={todo.status}>
      <span className={styles.text}>{todo.text}</span>
      <button
        type="button"
        className={styles.remove}
        onClick={() => {
          onRemove(todo.id)
        }}
      >
        delete
      </button>
      {MARKS.map(({ status, label, symbol }) => (
        <button
          key={status}
          type="button"
          className={styles.mark}
          data-mark={status}
          aria-label={label}
          aria-pressed={todo.status === status}
          onClick={() => {
            onToggleStatus(todo.id, status)
          }}
        >
          {symbol}
        </button>
      ))}
    </li>
  )
}
