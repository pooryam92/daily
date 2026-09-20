import { useSortable } from '@dnd-kit/react/sortable'
import { GripVertical, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import type { ResolvedStatus, Todo } from '@shared/todo'
import { ROW_ENTER, ROW_EXIT, ROW_LAYOUT } from '../lib/motion'
import { DoneCheckbox } from './DoneCheckbox'
import styles from './TodoItem.module.css'
import { TodoEditor } from './TodoEditor'

/** Open rows are sorted among themselves, and so are settled ones: see `TodoItemProps.group`. */
export type TodoGroup = 'open' | 'settled'

interface TodoItemProps {
  readonly todo: Todo
  /** The row's place in the list as it is shown. */
  readonly index: number
  /**
   * Which part of the list the row is shown in. A row can only be dragged within its own part:
   * dropped among the others, it would be moved straight back by the rule that put it there.
   */
  readonly group: TodoGroup
  readonly sorting: boolean
  /** Changes whenever the order of the list does: the only time rows have to be measured. */
  readonly order: string
  /** Whether this row was added while the card was open, as opposed to loaded with it. */
  readonly isNew: boolean
  /** Whether a new row animates in; false for todos added in quick succession. */
  readonly animateEnter: boolean
  readonly onToggleStatus: (id: string, status: ResolvedStatus) => void
  readonly onRemove: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

export function TodoItem({
  todo,
  index,
  group,
  sorting,
  order,
  isNew,
  animateEnter,
  onToggleStatus,
  onRemove,
  onEdit,
  ref
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const text = useRef<HTMLButtonElement>(null)

  const {
    ref: sortableRef,
    handleRef,
    isDragging
  } = useSortable({
    id: todo.id,
    index,
    type: group,
    accept: group,
    // dnd-kit animates its optimistic DOM moves; Motion handles changes outside a drag.
    // dnd-kit also disables this transition when reduced motion is requested.
    transition: { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    disabled: editing
  })

  const row = useRef<HTMLLIElement | null>(null)
  const setRow = useCallback(
    (node: HTMLLIElement | null) => {
      row.current = node
      sortableRef(node)
      if (typeof ref === 'function') return ref(node)
      if (ref != null) ref.current = node
    },
    [ref, sortableRef]
  )

  // With resolved todos settled below it, a new row is not always at the end of the list.
  useEffect(() => {
    if (isNew) row.current?.scrollIntoView({ block: 'nearest' })
    // Only when the row appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dropped = todo.status === 'dropped'

  return (
    <motion.li
      ref={setRow}
      className={styles.todo}
      data-status={todo.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      layout={sorting ? false : 'position'}
      layoutDependency={order}
      initial={isNew && animateEnter ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: ROW_EXIT }}
      transition={{ ...ROW_ENTER, layout: ROW_LAYOUT }}
    >
      {/* The bullet is the handle: it turns into a grip when the row is hovered. Space or Enter picks
          the row up from the keyboard, the arrow keys move it, Escape puts it back. */}
      <button
        ref={handleRef}
        type="button"
        className={styles.handle}
        data-todo-handle
        aria-label={`Reorder ${todo.text}`}
      >
        <span className={styles.bullet} aria-hidden="true" />
        <GripVertical className={styles.grip} size={14} aria-hidden="true" />
      </button>
      {editing ? (
        <TodoEditor
          text={todo.text}
          onCommit={(next) => {
            onEdit(todo.id, next)
          }}
          onClose={(how) => {
            setEditing(false)
            // Escape and Enter leave the keyboard where it was; after a click elsewhere, focus has moved on.
            if (how !== 'blur') requestAnimationFrame(() => text.current?.focus())
          }}
        />
      ) : (
        // A button, so the text can be reached and edited from the keyboard. Its text can still be
        // selected with the mouse: the deck leaves drags that start on a control alone.
        <button
          ref={text}
          type="button"
          className={styles.text}
          aria-label={`Edit ${todo.text}`}
          onClick={() => {
            // A drag across the text selects it, and ends in a click too; only a plain click edits.
            if (window.getSelection()?.isCollapsed === false) return
            setEditing(true)
          }}
        >
          <span className={styles.strike}>{todo.text}</span>
        </button>
      )}
      <button
        type="button"
        className={styles.remove}
        onClick={() => {
          onRemove(todo.id)
        }}
      >
        delete
      </button>
      <DoneCheckbox
        checked={todo.status === 'done'}
        onChange={() => {
          onToggleStatus(todo.id, 'done')
        }}
      />
      <button
        type="button"
        className={styles.drop}
        aria-label="Dropped"
        aria-pressed={dropped}
        onClick={() => {
          onToggleStatus(todo.id, 'dropped')
        }}
      >
        {/* Two icons cross-fading: a stroke width cannot fade, and it must not jump either. */}
        <X className={styles.idle} size={16} aria-hidden="true" />
        <X className={styles.pressed} size={16} strokeWidth={3} aria-hidden="true" />
      </button>
    </motion.li>
  )
}
