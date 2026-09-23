import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom'
import type { Sensors } from '@dnd-kit/dom'
import { useSortable } from '@dnd-kit/react/sortable'
import { ArrowLeft, ArrowRight, GripVertical } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import type { ResolvedStatus, Todo } from '@/domain/todo'
import type { MoveDirection, MoveTarget } from '../day/copy'
import { ROW_ENTER, ROW_EXIT, ROW_LAYOUT, ROW_MOVE_X } from '../lib/motion'
import { DoneCheckbox } from './DoneCheckbox'
import styles from './TodoItem.module.css'
import { TodoEditor } from './TodoEditor'

/** Open rows are sorted among themselves, and so are settled ones: see `TodoItemProps.group`. */
export type TodoGroup = 'open' | 'settled'

/** A press on one of these is not a drag. The text is a button too, but it drags. */
const ROW_CONTROLS = 'input, textarea, select, button:not([data-todo-text]), a'

/**
 * A row is picked up anywhere on it: at once on the grip, after 5px elsewhere so a click on the text
 * still edits it, and after a short hold on touch so the list still scrolls. The keyboard uses the grip.
 */
export const TODO_SENSORS: Sensors = [
  PointerSensor.configure({
    activatorElements: (source) => [source.element],
    activationConstraints: (event, source) => {
      if (event.pointerType === 'touch') {
        return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
      }
      if (event.target instanceof Element && source.handle?.contains(event.target) === true) return undefined
      return [new PointerActivationConstraints.Distance({ value: 5 })]
    },
    preventActivation: (event, source) => {
      if (!(event.target instanceof Element)) return false
      if (source.handle?.contains(event.target) === true) return false
      return event.target.closest(ROW_CONTROLS) !== null
    }
  }),
  KeyboardSensor
]

/**
 * Which way a moved row slides out, by id. `DayCard` fills it before a move and hands it to
 * `AnimatePresence` as `custom`, so a row reads it as it leaves; a deleted row only fades.
 */
export type LeavingRows = ReadonlyMap<string, MoveDirection>

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
  /** Where the move word sends the todo. */
  readonly moveTarget: MoveTarget
  readonly onToggleStatus: (id: string, status: ResolvedStatus) => void
  readonly onRemove: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
  readonly onMove: (id: string) => void
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/*
 * `☐ Buy milk ········ → tomorrow  drop`. What became of the todo is on the row; what the todo is
 * changes through its text (edit, and delete in the editor).
 */
export function TodoItem({
  todo,
  index,
  group,
  sorting,
  order,
  isNew,
  animateEnter,
  moveTarget,
  onToggleStatus,
  onRemove,
  onEdit,
  onMove,
  ref
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const text = useRef<HTMLButtonElement>(null)
  // Under reduced motion a moved row only fades, like a deleted one.
  const still = useReducedMotion() === true

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
  const Arrow = moveTarget.direction === 'next' ? ArrowRight : ArrowLeft

  return (
    <motion.li
      ref={setRow}
      className={styles.todo}
      data-todo
      data-status={todo.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      layout={sorting ? false : 'position'}
      layoutDependency={order}
      initial={isNew && animateEnter ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      variants={{
        // Towards the day a moved todo went to (`LeavingRows`).
        exit: (leaving: LeavingRows) => {
          const direction = leaving.get(todo.id)
          const x = direction === undefined || still ? 0 : direction === 'next' ? ROW_MOVE_X : -ROW_MOVE_X
          return { opacity: 0, x, transition: ROW_EXIT }
        }
      }}
      exit="exit"
      transition={{ ...ROW_ENTER, layout: ROW_LAYOUT }}
    >
      {/* The grip shows on hover. It is the keyboard's handle: Space or Enter picks the row up, the
          arrow keys move it, Escape puts it back. */}
      <button
        ref={handleRef}
        type="button"
        className={styles.handle}
        data-todo-handle
        aria-label={`Reorder ${todo.text}`}
      >
        <GripVertical className={styles.grip} size={14} aria-hidden="true" />
      </button>
      <DoneCheckbox
        checked={todo.status === 'done'}
        dropped={dropped}
        onChange={() => {
          // The box of a dropped todo reopens it.
          onToggleStatus(todo.id, dropped ? 'dropped' : 'done')
        }}
      />
      {editing ? (
        <TodoEditor
          text={todo.text}
          onCommit={(next) => {
            onEdit(todo.id, next)
          }}
          onDelete={() => {
            onRemove(todo.id)
          }}
          onClose={(how) => {
            setEditing(false)
            // Escape and Enter leave the keyboard where it was; after a click elsewhere or a delete, it has moved on.
            if (how === 'enter' || how === 'escape') requestAnimationFrame(() => text.current?.focus())
          }}
        />
      ) : (
        // A button, so the text can be edited from the keyboard. A press that moves drags the row.
        <button
          ref={text}
          type="button"
          className={styles.text}
          data-todo-text
          aria-label={`Edit ${todo.text}`}
          onClick={() => {
            setEditing(true)
          }}
        >
          <span className={styles.strike}>{todo.text}</span>
        </button>
      )}
      {/* Only an open todo has somewhere to go. The arrow points the way the deck flips. */}
      {todo.status === 'open' && (
        <button
          type="button"
          className={styles.move}
          aria-label={`Move ${todo.text} to ${moveTarget.name}`}
          onClick={() => {
            onMove(todo.id)
          }}
        >
          <Arrow size={12} aria-hidden="true" />
          {moveTarget.name}
        </button>
      )}
      <button
        type="button"
        className={styles.drop}
        aria-pressed={dropped}
        onClick={() => {
          onToggleStatus(todo.id, 'dropped')
        }}
      >
        drop
      </button>
    </motion.li>
  )
}
