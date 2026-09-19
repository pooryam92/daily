import { motion } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import type { Ref } from 'react'
import type { ResolvedStatus, Todo } from '@shared/todo'
import { ROW_ENTER, ROW_EXIT, ROW_LAYOUT } from '../lib/motion'
import { DoneCheckbox } from './DoneCheckbox'
import styles from './TodoItem.module.css'

interface TodoItemProps {
  readonly todo: Todo
  /** Changes whenever the order of the list does: the only time rows have to be measured. */
  readonly order: string
  /** Whether this row was added while the card was open, as opposed to loaded with it. */
  readonly isNew: boolean
  /** Whether a new row animates in; false for todos added in quick succession. */
  readonly animateEnter: boolean
  readonly onToggleStatus: (id: string, status: ResolvedStatus) => void
  readonly onRemove: (id: string) => void
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

export function TodoItem({ todo, order, isNew, animateEnter, onToggleStatus, onRemove, ref }: TodoItemProps) {
  const row = useRef<HTMLLIElement | null>(null)
  const setRow = useCallback(
    (node: HTMLLIElement | null) => {
      row.current = node
      if (typeof ref === 'function') return ref(node)
      if (ref != null) ref.current = node
    },
    [ref]
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
      layout="position"
      layoutDependency={order}
      initial={isNew && animateEnter ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: ROW_EXIT }}
      transition={{ ...ROW_ENTER, layout: ROW_LAYOUT }}
    >
      <span className={styles.text}>
        <span className={styles.strike}>{todo.text}</span>
      </span>
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
        {/* Two glyphs cross-fading: a font weight cannot fade, and it must not jump either. */}
        <span className={styles.idle} aria-hidden="true">
          ✗
        </span>
        <span className={styles.pressed} aria-hidden="true">
          ✗
        </span>
      </button>
    </motion.li>
  )
}
