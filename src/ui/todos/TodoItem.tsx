import { configure } from '@dnd-kit/abstract'
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom'
import type {
  DragDropManager,
  Draggable,
  DropAnimationFunction,
  PointerSensorOptions,
  Sensors
} from '@dnd-kit/dom'
import { DragOverlay, useDragDropManager, useDraggable } from '@dnd-kit/react'
import { useComputed } from '@dnd-kit/react/hooks'
import { GripVertical, Plus } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, Ref, RefObject } from 'react'
import type { Todo } from '@/domain/todo'
import { locate, stepProgress } from '@/domain/todo-rules'
import type { MoveDirection, MoveTarget } from '../day/copy'
import { COPY_CANCEL, ROW_ENTER, ROW_EXIT, ROW_LAYOUT, ROW_MOVE_X } from '../lib/motion'
import { DoneCheckbox } from './DoneCheckbox'
import { StepDraft } from './StepDraft'
import styles from './TodoItem.module.css'
import { TodoEditor } from './TodoEditor'
import type { EditorClose } from './TodoEditor'

/** A press on one of these is not a drag. The text is a button too, but it drags. */
const ROW_CONTROLS = 'input, textarea, select, button:not([data-todo-text]), a'

/**
 * The pointer sensor, kept to the pointer that pressed the row. Another finger or pen neither moves
 * the row nor lets it go. Every mouse shares one pointer id, so a second mouse, or a cursor that
 * passes over the window, is told apart by holding no button: those moves are not the drag's. A
 * release the window never sees ends nothing, as before: the next release, or Escape, does.
 */
class HeldPointerSensor extends PointerSensor {
  // The pointer that last pressed a row while none was held.
  private pressed: { readonly id: number; readonly mouse: boolean } | undefined

  constructor(manager: DragDropManager, options?: PointerSensorOptions) {
    super(manager, options)
    // The library keeps its release handler to itself, bound to the sensor, and listens with that.
    const sensor = this as unknown as { handlePointerUp: (event: PointerEvent) => void }
    const release = sensor.handlePointerUp
    sensor.handlePointerUp = (event) => {
      if (this.isPressed(event)) release(event)
    }
  }

  private isPressed(event: PointerEvent): boolean {
    return this.pressed === undefined || event.pointerId === this.pressed.id
  }

  protected override handlePointerDown(
    event: PointerEvent,
    source: Draggable,
    options: PointerSensorOptions | undefined
  ): void {
    // The library takes only a primary pointer's press, and none while a row is held.
    if (event.isPrimary && this.manager.dragOperation.status.idle) {
      this.pressed = { id: event.pointerId, mouse: event.pointerType === 'mouse' }
    }
    super.handlePointerDown(event, source, options)
  }

  protected override handlePointerMove(event: PointerEvent, source: Draggable): void {
    if (!this.isPressed(event) || (this.pressed?.mouse === true && event.buttons === 0)) return
    super.handlePointerMove(event, source)
  }

  protected override handleCancel(event: Event): void {
    if (event instanceof PointerEvent && !this.isPressed(event)) return
    super.handleCancel(event)
  }
}

/**
 * A row is picked up anywhere on it: at once on the grip, after 5px elsewhere so a click on the text
 * still edits it, and after a short hold on touch so the list still scrolls. The keyboard uses the grip.
 */
export const TODO_SENSORS: Sensors = [
  configure(HeldPointerSensor, {
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
  /** Changes whenever the height or the order of any row can: the only time rows have to be measured. */
  readonly order: string
  /** Whether the todo or step with this id was added while the card was open, as opposed to loaded with it. */
  readonly isNew: (id: string) => boolean
  /** Whether a new row animates in; false for todos added in quick succession. */
  readonly animateEnter: boolean
}

interface TodoItemProps extends RowActions, RowMotion {
  readonly todo: Todo
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
  /** Whether a row being dragged would belong to this todo if it were dropped now. */
  readonly dropTarget: boolean
  /** The todo or step whose grip takes the focus: see `useRegrip`. */
  readonly regrip: string | null
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
  dropTarget,
  regrip,
  ref
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  // Which step is being written, while one is: each step added starts a new draft.
  const [draft, setDraft] = useState(0)
  // Each time the step editor opens it is a new one, even while the last one still fades out: that
  // one has ended, and a new one takes the focus.
  const [opened, setOpened] = useState(0)
  const text = useRef<HTMLButtonElement>(null)
  // Under reduced motion a moved row only fades, like a deleted one.
  const still = useReducedMotion() === true

  const {
    ref: draggableRef,
    handleRef,
    isDragging
  } = useDraggable({ id: todo.id, disabled: editing || addingStep })
  const setItem = useItemRef(isNew(todo.id), ref, draggableRef)

  // A folded todo is one line, and its count says how its steps went; checking a todo folds it. Only
  // an open todo takes new steps.
  const folded = todo.folded === true
  const steps = folded ? [] : (todo.steps ?? [])
  const drafting = todo.status === 'open' && addingStep
  const stepsId = useId()
  const actions = { onToggleDone, onRemove, onEdit }

  return (
    <motion.li
      ref={setItem}
      className={styles.todo}
      data-todo
      data-status={todo.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      data-drop-target={dropTarget || undefined}
      layout="position"
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
        regrip={regrip === todo.id}
        drafting={drafting}
        move={{ target: moveTarget, onMove }}
        onStep={() => {
          // The step is written among the steps, so they have to show.
          if (folded) onToggleFold(todo.id)
          if (!drafting) setOpened((count) => count + 1)
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
                  // While a step is being written its field has the keyboard, and a press on a step
                  // above would take it away mid-word: the steps hold still, as the todo does.
                  disabled={drafting}
                  regrip={regrip === step.id}
                  order={order}
                  isNew={isNew}
                  animateEnter={animateEnter}
                  {...actions}
                />
              ))}
              {/* The line under the last step, where the step editor opens in its place. */}
              {!drafting && todo.status === 'open' && steps.length > 0 && (
                <StepSpace key="add" order={order} />
              )}
              {drafting && (
                <StepDraftItem
                  key={`draft-${String(opened)}`}
                  draft={draft}
                  first={(todo.steps?.length ?? 0) === 0}
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
  readonly disabled: boolean
  readonly regrip: boolean
  /** Set by `AnimatePresence`, which takes the step out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/**
 * A step: a row like its todo's, without a move word. Steps stay where they are when they are done,
 * and are dragged among their todo's steps the way a todo is among the todos.
 */
function StepItem({
  step,
  disabled,
  regrip,
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
    ref: draggableRef,
    handleRef,
    isDragging
  } = useDraggable({ id: step.id, disabled: editing || disabled })
  const setItem = useItemRef(isNew(step.id), ref, draggableRef)

  return (
    <motion.li
      ref={setItem}
      className={styles.step}
      data-todo
      data-step
      data-status={step.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      layout="position"
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
        regrip={regrip}
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
  /** Whether the todo has no steps yet: the field then asks for the first. */
  readonly first: boolean
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
function StepDraftItem({ draft, first, order, onAdd, onClose, ref }: StepDraftItemProps) {
  const item = useRef<HTMLLIElement | null>(null)
  const attach = useCallback((node: HTMLLIElement | null) => {
    item.current = node
  }, [])
  const setItem = useItemRef(true, ref, attach)
  // Once the draft has ended it only fades out: its field takes no focus and no typing then.
  const present = useIsPresent()

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
      inert={!present}
      layout="position"
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
          <StepDraft key={draft} first={first} onAdd={onAdd} onClose={onClose} />
        </div>
      </div>
    </motion.li>
  )
}

interface StepSpaceProps {
  readonly order: string
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/**
 * The last line of an open todo's steps: empty and shorter than a step, so the steps end before the
 * next todo, and the step editor opens there. The + on the todo's row opens it. It is not a row: nothing is
 * dropped on it, and a row dragged over it goes to the end of the steps above or before the todo
 * below, by the half it is over (rowDrag.ts).
 */
function StepSpace({ order, ref }: StepSpaceProps) {
  return (
    <motion.li
      ref={ref}
      className={[styles.step, styles.stepSpace].join(' ')}
      data-add-step
      aria-hidden="true"
      layout="position"
      layoutDependency={order}
      transition={{ layout: ROW_LAYOUT }}
    />
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
  /** Whether the grip takes the focus: see `useRegrip`. */
  readonly regrip?: boolean
  /** Whether a step is being written under the todo. */
  readonly drafting?: boolean
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

/** How long a grip watches for the focus to need it after a drop: the drop's animations and the old row's exit. */
const REGRIP_MS = 1000

/**
 * A keyboard drop that makes a todo a step, or a step a todo, puts the row in a new place on the page:
 * the row it was keeps the focus while it fades out, and the library may hand the focus back to it,
 * so once it is gone the focus is nowhere. The grip in the new place takes it then, and only then:
 * a focus that is somewhere is left where it is. Returns the grip's ref, handed on to `handleRef`.
 */
function useRegrip(
  regrip: boolean,
  handleRef: (element: Element | null) => void
): (element: HTMLButtonElement | null) => void {
  const grip = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!regrip) return
    const until = performance.now() + REGRIP_MS
    let frame = requestAnimationFrame(function check() {
      const focused = document.activeElement
      if (focused === null || focused === document.body || !focused.isConnected) grip.current?.focus()
      if (performance.now() < until) frame = requestAnimationFrame(check)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [regrip])

  return useCallback(
    (element: HTMLButtonElement | null) => {
      grip.current = element
      handleRef(element)
    },
    [handleRef]
  )
}

/** One line of the list, a todo's or a step's: the grip, the box, the text and the words at the end. */
function TodoRow({
  todo,
  editing,
  setEditing,
  textRef: text,
  handleRef,
  regrip = false,
  drafting = false,
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
  const grip = useRegrip(regrip, handleRef)

  const onTextKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    event.preventDefault()
    onRemove(todo.id)
  }

  return (
    <div
      className={styles.row}
      data-row={todo.id}
      data-status={todo.status}
      data-steps={counted || undefined}
      data-editing={editing || undefined}
      data-drafting={drafting || undefined}
      // While a step is written, a press on the row's empty end, where the + and the words were,
      // leaves the focus in the step editor: it is a slow second click on the +, not a way out.
      onMouseDown={(event) => {
        if (drafting && event.target === event.currentTarget) event.preventDefault()
      }}
    >
      {/* The grip shows on hover. It is the keyboard's handle: Space or Enter picks the row up, the
          arrow keys move where it would land (up and down, and right and left between a todo and a
          step), Space or Enter drops it, Escape puts it back. The deck leaves the arrow keys to a
          focused grip. */}
      <button
        ref={grip}
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
      </div>
      {/* The one way to add a step, on any open todo: before the pie when there are steps, in its
          place when there are none. A done todo takes no steps: an open step under it would undo
          "done flows down". */}
      {onStep !== undefined && todo.status === 'open' && (
        <button
          type="button"
          className={styles.add}
          aria-label={`Add a step to ${todo.text}`}
          title="Add a step"
          onClick={onStep}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      )}
      <StepCount todo={todo} id={countId} />
      {/* The pie is the toggle: this button lies over it at the row's end (TodoItem.module.css, .fold).
          It comes after the text, so the keyboard reaches it there. Folded steps are not on the page,
          so there is nothing to control. */}
      {fold !== undefined && counted && (
        <button
          type="button"
          className={styles.fold}
          aria-label={`Steps of ${todo.text}`}
          aria-expanded={!fold.folded}
          aria-controls={fold.folded ? undefined : fold.stepsId}
          aria-describedby={countId}
          title={fold.folded ? 'Show steps' : 'Hide steps'}
          onClick={fold.onToggle}
        />
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
        onClick={() => {
          onRemove(todo.id)
        }}
      >
        delete
      </button>
    </div>
  )
}

const ignore = (): void => undefined

/** The lifted copy, and where it was last placed on the page. */
interface PlacedCopy {
  readonly element: HTMLElement
  readonly x: number
  readonly y: number
}

/** Where the lifted copy sits from the pointer: right of it and below it, clear of the line it aims at. */
const COPY_OFFSET = { x: 16, y: 24 } as const

/** Where it sits from a finger, which covers what is under it: right of it and above it. */
const COPY_OFFSET_TOUCH = { x: 16, y: 40 } as const

/** How far inside the list's right edge the copy stays. */
const COPY_MARGIN_PX = 8

/**
 * What follows the pointer while a row is dragged: a small copy of it, its box and its text on one
 * line, and a todo's count, so that steps it carries can be seen to come along. The row itself stays
 * where it is, dimmed, and nothing else on the card moves until the drop. The copy sits beside the
 * pointer rather than under it, so it never covers the row aimed at, or the line: below and to the
 * right, or above a finger, and turned the other way at the list's edges rather than pushed back
 * over the pointer. A keyboard drag has no copy: the line and the focused grip say it all. The copy
 * is only to be looked at: the keyboard and screen readers keep the real row.
 */
export function DraggedCopy({
  ordered,
  bounds
}: {
  readonly ordered: readonly Todo[]
  /** The list, which the copy stays inside. */
  readonly bounds: HTMLElement | null
}) {
  const still = useReducedMotion() === true
  // The copy as it was last placed, and where. The library has hidden its overlay by the time the
  // drop is animated, so a fade is of a stand-in, put where the copy was.
  const copyRef = useRef<PlacedCopy | null>(null)
  // Dropped, the copy goes at once: the row slides to its place itself, in the list. Cancelled, or
  // let go outside the list, which cancels too, it fades where it is.
  const dropAnimation: DropAnimationFunction = ({ source }) => {
    const operation = source.manager?.dragOperation
    const at = operation?.position.current
    const list = bounds?.getBoundingClientRect()
    const outside =
      at !== undefined &&
      list !== undefined &&
      (at.x < list.left || at.x > list.right || at.y < list.top || at.y > list.bottom)
    const copy = copyRef.current
    copyRef.current = null
    if (still || copy === null || (operation?.canceled !== true && !outside)) return
    const ghost = copy.element.cloneNode(true)
    if (!(ghost instanceof HTMLElement)) return
    ghost.dataset.fading = ''
    ghost.style.left = `${String(copy.x)}px`
    ghost.style.top = `${String(copy.y)}px`
    document.body.append(ghost)
    void ghost.animate([{ opacity: 1 }, { opacity: 0 }], COPY_CANCEL).finished.then(() => {
      ghost.remove()
    })
  }
  return (
    <DragOverlay dropAnimation={dropAnimation}>
      {(source) => {
        const found = locate(ordered, String(source.id))
        if (found === undefined) return null
        return (
          <CopyChip todo={found.todo} step={found.parentId !== undefined} bounds={bounds} copyRef={copyRef} />
        )
      }}
    </DragOverlay>
  )
}

function CopyChip({
  todo,
  step,
  bounds,
  copyRef
}: {
  readonly todo: Todo
  readonly step: boolean
  readonly bounds: HTMLElement | null
  /** Where the copy is kept as it was last placed, for the fade when the drag is cancelled. */
  readonly copyRef: RefObject<PlacedCopy | null>
}) {
  const chip = useRef<HTMLDivElement>(null)
  const countId = useId()
  const manager = useDragDropManager()
  const pointer = useComputed(() => manager?.dragOperation.position.current, [manager]).value
  const activator = manager?.dragOperation.activatorEvent
  const keyboard = activator instanceof KeyboardEvent
  const touch = activator instanceof PointerEvent && activator.pointerType === 'touch'

  // The library moves the overlay, a box the size of the row, with the pointer. The copy is placed
  // inside it, from where the pointer is now.
  useLayoutEffect(() => {
    const element = chip.current
    const overlay = element?.parentElement
    if (element === null || overlay === null || overlay === undefined || pointer === undefined) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    const list = bounds?.getBoundingClientRect()
    const right = list === undefined ? Infinity : list.right - COPY_MARGIN_PX
    const x = Math.min(pointer.x + COPY_OFFSET.x, right - width)
    let y: number
    if (touch) {
      y = pointer.y - COPY_OFFSET_TOUCH.y - height
      if (list !== undefined && y < list.top) y = pointer.y + COPY_OFFSET_TOUCH.y
    } else {
      y = pointer.y + COPY_OFFSET.y
      if (list !== undefined && y + height > list.bottom) y = pointer.y - COPY_OFFSET.y - height
    }
    const box = overlay.getBoundingClientRect()
    element.style.left = `${String(x - box.left)}px`
    element.style.top = `${String(y - box.top)}px`
    copyRef.current = { element, x, y }
  }, [pointer, bounds, touch, copyRef])

  if (keyboard) return null
  return (
    <div
      ref={chip}
      className={styles.chip}
      data-drag-copy
      data-step={step || undefined}
      data-status={todo.status}
      aria-hidden
      inert
    >
      <DoneCheckbox checked={todo.status === 'done'} size={step ? 'sm' : 'md'} onChange={ignore} />
      <span className={styles.chipText}>
        <span className={styles.strike}>{todo.text}</span>
      </span>
      <StepCount todo={todo} id={countId} />
    </div>
  )
}

/**
 * How many of a todo's steps are done, as a pie that fills as they are: no figures to read at a
 * glance, since the steps themselves are a click away. Screen readers hear it in words, from the
 * element `id`; nothing is shown for a todo without steps.
 */
/** The pie's size, and the radius of its filled part, inside a ring that is half its colour. */
const PIE_PX = 16
const PIE_RADIUS = PIE_PX / 2 - 2.5

function StepPie({ done, total }: { readonly done: number; readonly total: number }) {
  const centre = PIE_PX / 2
  const part = done / total
  // The filled part starts at the top and goes clockwise.
  const angle = 2 * Math.PI * part - Math.PI / 2
  const end = `${String(centre + PIE_RADIUS * Math.cos(angle))} ${String(centre + PIE_RADIUS * Math.sin(angle))}`
  return (
    <svg
      width={PIE_PX}
      height={PIE_PX}
      viewBox={`0 0 ${String(PIE_PX)} ${String(PIE_PX)}`}
      aria-hidden="true"
    >
      <circle
        cx={centre}
        cy={centre}
        r={PIE_RADIUS + 0.75}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />
      {part >= 1 ? (
        <circle cx={centre} cy={centre} r={PIE_RADIUS} fill="currentColor" />
      ) : (
        part > 0 && (
          <path
            d={`M${String(centre)} ${String(centre)} V${String(centre - PIE_RADIUS)} A${String(PIE_RADIUS)} ${String(PIE_RADIUS)} 0 ${part > 0.5 ? '1' : '0'} 1 ${end} Z`}
            fill="currentColor"
          />
        )
      )}
    </svg>
  )
}

function StepCount({ todo, id }: { readonly todo: Todo; readonly id: string }) {
  const { done, total } = stepProgress(todo)
  if (total === 0) return null
  return (
    <span
      className={styles.count}
      data-done={done}
      data-total={total}
      data-complete={done === total || undefined}
    >
      <StepPie done={done} total={total} />
      <span
        id={id}
        className={styles.visuallyHidden}
      >{`${String(done)} of ${String(total)} ${total === 1 ? 'step' : 'steps'} done`}</span>
    </span>
  )
}
