import type { Modifiers } from '@dnd-kit/abstract'
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers'
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom'
import type { Sensors } from '@dnd-kit/dom'
import { RestrictToElement } from '@dnd-kit/dom/modifiers'
import { useSortable } from '@dnd-kit/react/sortable'
import { ChevronRight, GripVertical } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, Ref, RefObject } from 'react'
import type { Todo } from '@/domain/todo'
import { stepProgress } from '@/domain/todo-rules'
import type { MoveDirection, MoveTarget } from '../day/copy'
import { ROW_ENTER, ROW_EXIT, ROW_LAYOUT, ROW_MOVE_X } from '../lib/motion'
import { DoneCheckbox } from './DoneCheckbox'
import { StepDraft } from './StepDraft'
import styles from './TodoItem.module.css'
import { TodoEditor } from './TodoEditor'
import type { EditorClose } from './TodoEditor'

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

/** How a sorted row eases into its new place while another is dragged past it. */
const SORT_TRANSITION = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

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
  /** Adds a step at the end of the steps of the todo `parentId`. */
  readonly onAddStep: (text: string, parentId: string) => void
  /** Whether a step is being written under the todo. The card keeps it: it moves the rows below. */
  readonly addingStep: boolean
  readonly onAddingStep: (open: boolean) => void
  /** Folds the todo's steps away, or shows them again. */
  readonly onToggleFold: (id: string) => void
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
 * `☐ Buy milk 1/3 ········ tomorrow   delete`, and while the todo is open, its steps under it, and
 * under those the step being written, if any. The words at the end are two tiers: where the todo
 * goes (move), then set apart and fainter, whether it was a mistake (delete). Left to right they are
 * ever more final, so the row is a spectrum to read, not a menu to compare.
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
  onAddStep,
  addingStep,
  onAddingStep,
  onToggleFold,
  ref
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  // Which step is being written, while one is: each step added starts a new draft.
  const [draft, setDraft] = useState(0)
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
    transition: SORT_TRANSITION,
    disabled: editing || addingStep
  })
  const setItem = useItemRef(isNew(todo.id), ref, sortableRef)

  // A folded todo is one line, and its count says how its steps went; checking a todo folds it. Only
  // an open todo takes new steps.
  const folded = todo.folded === true
  const steps = folded ? [] : (todo.steps ?? [])
  const drafting = todo.status === 'open' && addingStep
  const stepsId = useId()
  const actions = { onToggleDone, onRemove, onEdit }
  // The list a dragged step is held in: its own todo's steps, and nowhere else on the card.
  const [stepList, setStepList] = useState<HTMLUListElement | null>(null)
  const stepModifiers = useMemo(
    () => [RestrictToVerticalAxis, RestrictToElement.configure({ element: () => stepList })],
    [stepList]
  )

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
        textRef={text}
        handleRef={handleRef}
        move={{ target: moveTarget, onMove }}
        onStep={() => {
          // The step is written among the steps, so they have to show.
          if (folded) onToggleFold(todo.id)
          onAddingStep(true)
        }}
        fold={{
          folded,
          stepsId,
          onToggle: () => {
            onToggleFold(todo.id)
          }
        }}
        {...actions}
      />
      {/* The steps fold away together, by the count or by checking the todo, and come back when it is
          unfolded. `popLayout` takes them out of the flow at once, so the rows below close up while
          they fade. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {(steps.length > 0 || drafting) && (
          <motion.ul
            key="steps"
            id={stepsId}
            ref={setStepList}
            className={styles.steps}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: ROW_ENTER }}
            exit={{ opacity: 0, transition: ROW_EXIT }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {steps.map((step, stepIndex) => (
                <StepItem
                  key={step.id}
                  step={step}
                  parentId={todo.id}
                  index={stepIndex}
                  modifiers={stepModifiers}
                  // While a step is being written its field has the keyboard, and a press on a step
                  // above would take it away mid-word: the steps hold still, as the todo does.
                  disabled={drafting}
                  sorting={sorting}
                  order={order}
                  isNew={isNew}
                  animateEnter={animateEnter}
                  {...actions}
                />
              ))}
              {drafting && (
                <StepDraftItem
                  key="draft"
                  draft={draft}
                  sorting={sorting}
                  order={order}
                  onAdd={(next) => {
                    onAddStep(next, todo.id)
                    setDraft((count) => count + 1)
                  }}
                  onClose={(how) => {
                    onAddingStep(false)
                    // As in the editor: Escape and Enter leave the keyboard on the todo.
                    if (how === 'enter' || how === 'escape')
                      requestAnimationFrame(() => text.current?.focus())
                  }}
                />
              )}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

interface StepItemProps extends RowActions, RowMotion {
  readonly step: Todo
  /**
   * The todo the step is under. It is the step's sortable group, type and accept: a step is sorted
   * among its siblings only, and its index (its place in the todo's steps) is counted among them,
   * apart from the todos', whose indexes it would otherwise collide with.
   */
  readonly parentId: string
  readonly index: number
  /** What holds a dragged step: the vertical axis and its todo's steps list. They replace the card's. */
  readonly modifiers: Modifiers
  readonly disabled: boolean
  /** Set by `AnimatePresence`, which takes the step out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/**
 * A step: a row like its todo's, without a move word. Steps stay where they are when they are done,
 * and are dragged among their todo's steps the way a todo is among the todos.
 */
function StepItem({
  step,
  parentId,
  index,
  modifiers,
  disabled,
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
  const text = useRef<HTMLButtonElement>(null)
  const {
    ref: sortableRef,
    handleRef,
    isDragging
  } = useSortable({
    id: step.id,
    index,
    group: parentId,
    type: parentId,
    accept: parentId,
    modifiers,
    transition: SORT_TRANSITION,
    disabled: editing || disabled
  })
  const setItem = useItemRef(isNew(step.id), ref, sortableRef)

  return (
    <motion.li
      ref={setItem}
      className={styles.step}
      data-todo
      data-step
      data-status={step.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
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
        textRef={text}
        handleRef={handleRef}
        onToggleDone={onToggleDone}
        onRemove={onRemove}
        onEdit={onEdit}
      />
    </motion.li>
  )
}

interface StepDraftItemProps {
  /** Which draft this is: each step added starts a new one, empty. */
  readonly draft: number
  readonly sorting: boolean
  readonly order: string
  readonly onAdd: (text: string) => void
  readonly onClose: (how: EditorClose) => void
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/**
 * The step being written, as the last of the steps: a step's row with the field in place of the
 * text, and an empty box that can be checked once it is a step. The row itself stays while one step
 * after another is added: it slides down under each new step, and only the field starts afresh.
 */
function StepDraftItem({ draft, sorting, order, onAdd, onClose, ref }: StepDraftItemProps) {
  const item = useRef<HTMLLIElement | null>(null)
  const attach = useCallback((node: HTMLLIElement | null) => {
    item.current = node
  }, [])
  const setItem = useItemRef(true, ref, attach)

  // The row moves down with every step added, so it is brought into view again each time.
  useEffect(() => {
    if (draft > 0) item.current?.scrollIntoView({ block: 'nearest' })
  }, [draft])

  // A press anywhere on the row but the field keeps the field focused, so the draft is not ended by it.
  const keepFocus = (event: MouseEvent): void => {
    if (!(event.target instanceof HTMLTextAreaElement)) event.preventDefault()
  }

  return (
    <motion.li
      ref={setItem}
      data-step
      data-draft
      layout={sorting ? false : 'position'}
      layoutDependency={order}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: ROW_EXIT }}
      transition={{ ...ROW_ENTER, layout: ROW_LAYOUT }}
    >
      <div className={styles.row} data-status="open" data-editing onMouseDown={keepFocus}>
        {/* The grip's slot, so the box lines up with the steps above; there is nothing to move yet. */}
        <span className={styles.handle} aria-hidden="true" />
        <DoneCheckbox checked={false} size="sm" />
        <div className={styles.label}>
          <StepDraft key={draft} onAdd={onAdd} onClose={onClose} />
        </div>
      </div>
    </motion.li>
  )
}

interface TodoRowProps extends RowActions {
  readonly todo: Todo
  readonly editing: boolean
  readonly setEditing: (editing: boolean) => void
  /** The text button, which the keyboard goes back to when an edit, or the step editor, is done. */
  readonly textRef: RefObject<HTMLButtonElement | null>
  /** The drag handle's ref. */
  readonly handleRef: (element: Element | null) => void
  /** Where the move word sends the todo. Steps have none: they go wherever their todo goes. */
  readonly move?: { readonly target: MoveTarget; readonly onMove: (id: string) => void }
  /** Opens the step editor under the todo. Steps have none: a step cannot have steps. */
  readonly onStep?: () => void
  /**
   * Whether the todo's steps are folded away, the id of their list, and what folds or unfolds them.
   * Steps have none.
   */
  readonly fold?: { readonly folded: boolean; readonly stepsId: string; readonly onToggle: () => void }
}

/** One line of the list, a todo's or a step's: the grip, the box, the text and the words at the end. */
function TodoRow({
  todo,
  editing,
  setEditing,
  textRef: text,
  handleRef,
  move,
  onStep,
  fold,
  onToggleDone,
  onRemove,
  onEdit
}: TodoRowProps) {
  const step = move === undefined
  // The count is read out with the toggle that lies over it, as its description.
  const countId = useId()
  const counted = stepProgress(todo).total > 0

  const onTextKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    event.preventDefault()
    onRemove(todo.id)
  }

  return (
    <div className={styles.row} data-status={todo.status} data-editing={editing || undefined}>
      {/* The grip shows on hover. It is the keyboard's handle: Space or Enter picks the row up, the
          arrow keys move it, Space or Enter drops it, Escape puts it back. A step's grip moves the step
          among its todo's steps. The deck leaves the arrow keys to a focused grip. */}
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
        size={step ? 'sm' : 'md'}
        onChange={() => {
          onToggleDone(todo.id)
        }}
      />
      <div className={styles.label}>
        {editing ? (
          <TodoEditor
            text={todo.text}
            // A done todo takes no steps: an open step under it would undo "done flows down".
            canStep={onStep !== undefined && todo.status === 'open'}
            onCommit={(next) => {
              onEdit(todo.id, next)
            }}
            onClose={(how) => {
              setEditing(false)
              // Escape and Enter leave the keyboard where it was; after a click elsewhere, it has moved
              // on, and after `step` it is in the step editor.
              if (how === 'step') onStep?.()
              else if (how !== 'blur') requestAnimationFrame(() => text.current?.focus())
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
            {/* No space between them: the count goes with the last word, and never onto a line alone. */}
            <span className={styles.strike}>{todo.text}</span>
            <StepCount todo={todo} id={countId} />
          </button>
        )}
      </div>
      {/* The count is the toggle: this button lies over it (TodoItem.module.css, .fold), so a click on
          the count folds the steps and a click on the text still edits it. It comes after the text, so
          the keyboard reaches it there. Folded steps are not on the page, so there is nothing to control. */}
      {fold !== undefined && counted && (
        <button
          type="button"
          className={styles.fold}
          aria-label={`Steps of ${todo.text}`}
          aria-expanded={!fold.folded}
          aria-controls={fold.folded ? undefined : fold.stepsId}
          aria-describedby={countId}
          onClick={fold.onToggle}
        >
          <ChevronRight size={12} aria-hidden="true" />
        </button>
      )}
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
        // The second click of a double click is never meant for this word. It lands here when the
        // first one was on the editor's `step`, which sits where this word is once the edit is over:
        // it neither deletes nor takes the focus from the step editor that `step` opened.
        onMouseDown={(event) => {
          if (event.detail > 1) event.preventDefault()
        }}
        onClick={(event) => {
          if (event.detail > 1) return
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
 * are few. Screen readers hear it in words, from the element `id`; nothing is shown for a todo
 * without steps.
 */
function StepCount({ todo, id }: { readonly todo: Todo; readonly id: string }) {
  const { done, total } = stepProgress(todo)
  if (total === 0) return null
  return (
    <span className={styles.count} data-complete={done === total || undefined}>
      <span aria-hidden="true">
        {done}/{total}
      </span>
      <span
        id={id}
        className={styles.visuallyHidden}
      >{`${String(done)} of ${String(total)} ${total === 1 ? 'step' : 'steps'} done`}</span>
    </span>
  )
}
