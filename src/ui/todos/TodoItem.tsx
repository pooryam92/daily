import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom'
import type { Sensors } from '@dnd-kit/dom'
import { useSortable } from '@dnd-kit/react/sortable'
import { GripVertical } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import type { Todo } from '@/domain/todo'
import { stepProgress } from '@/domain/todo-rules'
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
      // A press on a step reaches its parent's item too, and must not pick the parent up.
      if (event.target.closest('[data-todo]') !== source.element) return true
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

/** What a todo and a step both do: the handlers take the id of either. */
interface RowActions {
  readonly onToggleDone: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
}

/** How a todo, or a step, enters and is measured. The same for both, so a step moves with its todo. */
interface RowMotion {
  readonly sorting: boolean
  /** Changes whenever the height or the order of any row can: the only time rows have to be measured. */
  readonly order: string
  /** Whether the todo or step with this id was added while the card was open, as opposed to loaded with it. */
  readonly isNew: (id: string) => boolean
  /** Whether a new row animates in; false for todos added in quick succession. */
  readonly animateEnter: boolean
}

interface TodoItemProps extends RowActions, RowMotion {
  readonly todo: Todo
  /** The row's place in the list as it is shown. */
  readonly index: number
  /**
   * Which part of the list the row is shown in. A row can only be dragged within its own part:
   * dropped among the others, it would be moved straight back by the rule that put it there.
   */
  readonly group: TodoGroup
  /** Where the move word sends the todo. */
  readonly moveTarget: MoveTarget
  readonly onMove: (id: string) => void
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/** Hands the element to a ref of either kind, and returns the cleanup a callback ref may give. */
function handOn(ref: Ref<HTMLLIElement> | undefined, node: HTMLLIElement | null): (() => void) | undefined {
  if (typeof ref === 'function') return ref(node) ?? undefined
  if (ref != null) ref.current = node
  return undefined
}

/**
 * The item's element, handed on to `ref` and `attach` as well. A new item scrolls into view as it
 * appears: with resolved todos settled below it, a new row is not always at the end of the list.
 */
function useItemRef(
  isNew: boolean,
  ref: Ref<HTMLLIElement> | undefined,
  attach?: (node: HTMLLIElement | null) => void
): (node: HTMLLIElement | null) => (() => void) | undefined {
  const item = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (isNew) item.current?.scrollIntoView({ block: 'nearest' })
    // Only when the item appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useCallback(
    (node: HTMLLIElement | null) => {
      item.current = node
      attach?.(node)
      return handOn(ref, node)
    },
    [ref, attach]
  )
}

/*
 * `☐ Buy milk 1/3 ········ tomorrow   delete`, and while the todo is open, its steps under it. The
 * words at the end are two tiers: where the todo goes (move), then set apart and fainter, whether it
 * was a mistake (delete). Left to right they are ever more final, so the row is a spectrum to read,
 * not a menu to compare.
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
  onToggleDone,
  onRemove,
  onEdit,
  onMove,
  ref
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
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
  const setItem = useItemRef(isNew(todo.id), ref, sortableRef)

  // A done todo is one line: its count says how its steps went.
  const steps = todo.status === 'open' ? (todo.steps ?? []) : []
  const actions = { onToggleDone, onRemove, onEdit }

  return (
    <motion.li
      ref={setItem}
      className={styles.todo}
      data-todo
      data-status={todo.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      layout={sorting ? false : 'position'}
      layoutDependency={order}
      initial={isNew(todo.id) && animateEnter ? { opacity: 0, y: -8 } : false}
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
      <TodoRow
        todo={todo}
        editing={editing}
        setEditing={setEditing}
        handleRef={handleRef}
        move={{ target: moveTarget, onMove }}
        {...actions}
      />
      {/* The steps fold away together when the todo is checked, and come back when it is reopened.
          `popLayout` takes them out of the flow at once, so the rows below close up while they fade. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {steps.length > 0 && (
          <motion.ul
            key="steps"
            className={styles.steps}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: ROW_ENTER }}
            exit={{ opacity: 0, transition: ROW_EXIT }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {steps.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  sorting={sorting}
                  order={order}
                  isNew={isNew}
                  animateEnter={animateEnter}
                  {...actions}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

interface StepItemProps extends RowActions, RowMotion {
  readonly step: Todo
  /** Set by `AnimatePresence`, which takes the step out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/** A step: a row like its todo's, without a move word. Steps stay where they are when they are done. */
function StepItem({
  step,
  sorting,
  order,
  isNew,
  animateEnter,
  onToggleDone,
  onRemove,
  onEdit,
  ref
}: StepItemProps) {
  const [editing, setEditing] = useState(false)
  const setItem = useItemRef(isNew(step.id), ref)

  return (
    <motion.li
      ref={setItem}
      data-todo
      data-step
      data-status={step.status}
      data-editing={editing || undefined}
      layout={sorting ? false : 'position'}
      layoutDependency={order}
      initial={isNew(step.id) && animateEnter ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: ROW_EXIT }}
      transition={{ ...ROW_ENTER, layout: ROW_LAYOUT }}
    >
      <TodoRow
        todo={step}
        editing={editing}
        setEditing={setEditing}
        onToggleDone={onToggleDone}
        onRemove={onRemove}
        onEdit={onEdit}
      />
    </motion.li>
  )
}

interface TodoRowProps extends RowActions {
  readonly todo: Todo
  readonly editing: boolean
  readonly setEditing: (editing: boolean) => void
  /** The drag handle's ref. Without one the row is a step's, which cannot be reordered. */
  readonly handleRef?: (element: Element | null) => void
  /** Where the move word sends the todo. Steps have none: they go wherever their todo goes. */
  readonly move?: { readonly target: MoveTarget; readonly onMove: (id: string) => void }
}

/** One line of the list, a todo's or a step's: the grip, the box, the text and the words at the end. */
function TodoRow({
  todo,
  editing,
  setEditing,
  handleRef,
  move,
  onToggleDone,
  onRemove,
  onEdit
}: TodoRowProps) {
  const text = useRef<HTMLButtonElement>(null)
  const step = handleRef === undefined

  const onTextKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    event.preventDefault()
    onRemove(todo.id)
  }

  return (
    <div className={styles.row} data-status={todo.status} data-editing={editing || undefined}>
      {/* The grip shows on hover. It is the keyboard's handle: Space or Enter picks the row up, the
          arrow keys move it, Escape puts it back. A step's grip only keeps its box in line with the
          others: it moves nothing, so it is inert, out of reach of the keyboard and of screen readers. */}
      <button
        ref={handleRef}
        type="button"
        className={styles.handle}
        data-todo-handle={step ? undefined : true}
        aria-label={`Reorder ${todo.text}`}
        inert={step}
      >
        <GripVertical className={styles.grip} size={14} aria-hidden="true" />
      </button>
      <DoneCheckbox
        checked={todo.status === 'done'}
        size={step ? 'sm' : 'md'}
        onChange={() => {
          onToggleDone(todo.id)
        }}
      />
      {/* The text wraps and the count stays on its first line, right after it. A click on the room
          left after them edits the text, as it did when the text filled the row. */}
      <div
        className={styles.label}
        onClick={(event) => {
          if (event.target === event.currentTarget && !editing) setEditing(true)
        }}
      >
        {editing ? (
          <TodoEditor
            text={todo.text}
            onCommit={(next) => {
              onEdit(todo.id, next)
            }}
            onClose={(how) => {
              setEditing(false)
              // Escape and Enter leave the keyboard where it was; after a click elsewhere, it has moved on.
              if (how !== 'blur') requestAnimationFrame(() => text.current?.focus())
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
            onKeyDown={onTextKeyDown}
          >
            <span className={styles.strike}>{todo.text}</span>
          </button>
        )}
        <StepCount todo={todo} />
      </div>
      {move !== undefined && todo.status === 'open' && (
        <button
          type="button"
          className={styles.move}
          aria-label={`Move ${todo.text} to ${move.target.name}`}
          onClick={() => {
            move.onMove(todo.id)
          }}
        >
          {move.target.name}
        </button>
      )}
      <button
        type="button"
        className={styles.remove}
        aria-label={`Delete ${todo.text}`}
        onClick={() => {
          onRemove(todo.id)
        }}
      >
        delete
      </button>
    </div>
  )
}

/**
 * How many of a todo's steps are done, as `1/3`: a count rather than a percentage, since the steps
 * are few. Screen readers hear it in words; nothing is shown for a todo without steps.
 */
function StepCount({ todo }: { readonly todo: Todo }) {
  const { done, total } = stepProgress(todo)
  if (total === 0) return null
  return (
    <span className={styles.count} data-complete={done === total || undefined}>
      <span aria-hidden="true">
        {done}/{total}
      </span>
      <span
        className={styles.visuallyHidden}
      >{`${String(done)} of ${String(total)} ${total === 1 ? 'step' : 'steps'} done`}</span>
    </span>
  )
}
