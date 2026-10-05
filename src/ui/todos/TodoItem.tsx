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
import { ChevronDown, ListPlus, Pin, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { use, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref, RefObject } from 'react'
import type { DayKey, Todo } from '@/domain/todo'
import { compareDays } from '@/domain/dates'
import { locate, stepProgress } from '@/domain/todo-rules'
import { daysSince, sinceLine } from '../day/copy'
import type { MoveDirection, MoveTarget } from '../day/copy'
import { dragWords } from '../day/rowDrag'
import { COPY_CANCEL, ROW_ENTER, ROW_EXIT, ROW_LAYOUT, ROW_MOVE_X } from '../lib/motion'
import { guardClicks, guarded } from './clickGuard'
import { DoneCheckbox } from './DoneCheckbox'
import { leaveRow, MoveIcon, RowMenu, RowMenusFront } from './RowMenu'
import type { RowMenuOpen } from './RowMenu'
import { RowTip } from './RowTip'
import { StepDraft } from './StepDraft'
import styles from './TodoItem.module.css'
import { TodoEditor } from './TodoEditor'
import type { EditorClose } from './TodoEditor'

/** A press on one of these is not a drag. The text is a button too, but it drags. */
const ROW_CONTROLS = 'input, textarea, select, button:not([data-todo-text]), a'

/**
 * The pointer sensor, kept to the pointer that pressed the row: another finger or pen neither moves nor
 * drops it. Every mouse shares one pointer id, so a mouse move with no button held is not the drag's. A
 * release the window never sees ends nothing: the next release, or Escape, does.
 */
class HeldPointerSensor extends PointerSensor {
  // The pointer that last pressed a row while none was held.
  private pressed: { readonly id: number; readonly mouse: boolean } | undefined
  // While a row is being picked up, the last move of the pointer, which the drag has not been told.
  private pending: { readonly event: PointerEvent; readonly source: Draggable } | undefined
  private readonly unlisten: () => void

  constructor(manager: DragDropManager, options?: PointerSensorOptions) {
    super(manager, options)
    // The library keeps its release handler to itself, bound to the sensor, and listens with that.
    const sensor = this as unknown as { handlePointerUp: (event: PointerEvent) => void }
    const release = sensor.handlePointerUp
    sensor.handlePointerUp = (event) => {
      this.pending = undefined
      if (this.isPressed(event)) release(event)
    }
    // The library takes no moves until the drag starts; replay the held one so the copy starts beside
    // the pointer.
    this.unlisten = manager.monitor.addEventListener('dragstart', () => {
      const pending = this.pending
      this.pending = undefined
      if (pending !== undefined) super.handlePointerMove(pending.event, pending.source)
    })
  }

  override destroy(): void {
    this.unlisten()
    super.destroy()
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
      this.pending = undefined
    }
    super.handlePointerDown(event, source, options)
  }

  protected override handlePointerMove(event: PointerEvent, source: Draggable): void {
    if (!this.isPressed(event) || (this.pressed?.mouse === true && event.buttons === 0)) return
    if (this.pending !== undefined) {
      this.pending = { event, source }
      return
    }
    super.handlePointerMove(event, source)
  }

  protected override handleStart(source: Draggable, event: PointerEvent): void {
    super.handleStart(source, event)
    const { status } = this.manager.dragOperation
    if (!status.idle && !status.dragging) this.pending = { event, source }
  }

  protected override handleCancel(event: Event): void {
    if (event instanceof PointerEvent && !this.isPressed(event)) return
    this.pending = undefined
    super.handleCancel(event)
  }
}

/**
 * A row is picked up anywhere but its controls: after 5px, so a click on the text still edits it, and after
 * a hold on touch, so the list still scrolls. The keyboard picks it up from its text with Space.
 */
export const TODO_SENSORS: Sensors = [
  configure(HeldPointerSensor, {
    activatorElements: (source) => [source.element],
    activationConstraints: (event) => {
      if (event.pointerType === 'touch') {
        return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
      }
      return [new PointerActivationConstraints.Distance({ value: 5 })]
    },
    preventActivation: (event, source) => {
      if (!(event.target instanceof Element)) return false
      // A press on a step reaches its parent's item too, and must not pick the parent up.
      if (event.target.closest('[data-todo]') !== source.element) return true
      return event.target.closest(ROW_CONTROLS) !== null
    }
  }),
  KeyboardSensor.configure({
    keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] }
  })
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
  /** Whether the todo or step with this id was added while the card was open, not loaded with it. */
  readonly isNew: (id: string) => boolean
  /** Whether a new row animates in; false for todos added in quick succession. */
  readonly animateEnter: boolean
}

interface TodoItemProps extends RowActions, RowMotion {
  readonly todo: Todo
  /** The card's day, and today, which a sticky todo travels to and counts its age to. */
  readonly day: DayKey
  readonly today: DayKey
  /** Where the move button sends the todo. */
  readonly moveTarget: MoveTarget
  readonly onMove: (id: string) => void
  readonly onToggleSticky: (id: string, fromKeys: boolean) => void
  /** Adds a step at the end of the steps of the todo `parentId`. */
  readonly onAddStep: (text: string, parentId: string) => void
  /** Whether a step is being written under the todo. The card keeps it: it moves the rows below. */
  readonly addingStep: boolean
  readonly onAddingStep: (open: boolean) => void
  readonly onToggleFold: (id: string) => void
  /** Whether a row being dragged would belong to this todo if it were dropped now. */
  readonly dropTarget: boolean
  /** The todo or step whose text takes the focus: see `useRefocus`. */
  readonly refocus: string | null
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
 * `› ☐ Buy milk 1/3 ········ [carry] [add a step] [move]   [delete]`, with its steps under it while it is open.
 * Left to right the buttons grow more final, delete set apart: a spectrum to read, not a menu to compare.
 */
export function TodoItem({
  todo,
  day,
  today,
  order,
  isNew,
  animateEnter,
  moveTarget,
  onToggleDone,
  onRemove,
  onEdit,
  onMove,
  onToggleSticky,
  onAddStep,
  addingStep,
  onAddingStep,
  onToggleFold,
  dropTarget,
  refocus,
  ref
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  // Which step is being written, while one is: each step added starts a new draft.
  const [draft, setDraft] = useState(0)
  // Each time the step editor opens it is a new one, even while the last one still fades out: that
  // one has ended, and a new one takes the focus.
  const [opened, setOpened] = useState(0)
  const text = useRef<HTMLButtonElement>(null)
  // The button under the steps, and whether the step editor was opened from it: the keyboard goes back
  // to where it came from when the editor closes.
  const more = useRef<HTMLButtonElement>(null)
  const fromMore = useRef(false)
  const refold = useRef(false)
  // Under reduced motion a moved row only fades, like a deleted one.
  const still = useReducedMotion() === true

  const {
    ref: draggableRef,
    handleRef,
    isDragging
  } = useDraggable({ id: todo.id, disabled: editing || addingStep })
  const setItem = useItemRef(isNew(todo.id), ref, draggableRef)
  // A row that is fading out is no longer one the keyboard can go to (RowMenu.tsx, nextFocus).
  const present = useIsPresent()

  // A folded todo is one line, and its count says how its steps went; checking a todo folds it. Only
  // an open todo takes new steps.
  const folded = todo.folded === true
  const steps = folded ? [] : (todo.steps ?? [])
  const drafting = todo.status === 'open' && addingStep
  const reopenLeaves = todo.sticky !== undefined && todo.status === 'done' && compareDays(day, today) < 0
  const stepsId = useId()
  const actions = { onToggleDone, onRemove, onEdit }
  const addStep = (fromIcon = false): void => {
    fromMore.current = fromIcon
    // The step is written among the steps, so they have to show.
    if (folded) {
      refold.current = true
      onToggleFold(todo.id)
    }
    if (!drafting) setOpened((count) => count + 1)
    onAddingStep(true)
  }

  return (
    <motion.li
      ref={setItem}
      className={styles.todo}
      data-todo
      data-status={todo.status}
      data-sticky={todo.sticky !== undefined || undefined}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      data-leaving={!present || undefined}
      inert={!present}
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
        refocus={refocus === todo.id}
        drafting={drafting}
        move={{ target: moveTarget, onMove }}
        reopenLeaves={reopenLeaves}
        stick={{
          today,
          // Stuck on a past day, it goes on to today.
          leaves: todo.sticky === undefined && compareDays(day, today) < 0,
          onToggle: (fromKeys) => {
            onToggleSticky(todo.id, fromKeys)
          }
        }}
        onStep={() => {
          addStep()
        }}
        fold={{
          folded,
          stepsId,
          onToggle: () => {
            onToggleFold(todo.id)
          },
          onPress: () => {
            refold.current = false
          }
        }}
        {...actions}
      />
      {/* `popLayout` takes folding steps out of the flow at once, so the rows below close up while they
          fade. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {(steps.length > 0 || drafting) && (
          <StepList key="steps" id={stepsId}>
            <AnimatePresence mode="popLayout" initial={false}>
              {steps.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  // While a step is being written its field has the keyboard, and a press on a step
                  // above would take it away mid-word: the steps hold still, as the todo does.
                  disabled={drafting}
                  refocus={refocus === step.id}
                  reopenLeaves={reopenLeaves}
                  order={order}
                  isNew={isNew}
                  animateEnter={animateEnter}
                  {...actions}
                />
              ))}
              {/* The step editor opens in the place of this line. */}
              {!drafting && todo.status === 'open' && steps.length > 0 && (
                <StepSpace
                  key="add"
                  text={todo.text}
                  order={order}
                  buttonRef={more}
                  onStep={() => {
                    addStep(true)
                  }}
                />
              )}
              {drafting && (
                <StepDraftItem
                  key={`draft-${String(opened)}`}
                  draft={draft}
                  first={(todo.steps?.length ?? 0) === 0}
                  order={order}
                  onAdd={(next) => {
                    refold.current = false
                    onAddStep(next, todo.id)
                    setDraft((count) => count + 1)
                  }}
                  onClose={(how) => {
                    onAddingStep(false)
                    if (refold.current && !folded) onToggleFold(todo.id)
                    refold.current = false
                    // As in the editor, Escape and Enter leave the keyboard where it was: on the button
                    // under the steps, back in its place, or on the todo.
                    if (how === 'enter' || how === 'escape')
                      requestAnimationFrame(() => (fromMore.current ? more.current : text.current)?.focus())
                  }}
                />
              )}
            </AnimatePresence>
          </StepList>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function StepList({
  id,
  children,
  ref
}: {
  readonly id: string
  readonly children: ReactNode
  readonly ref?: Ref<HTMLUListElement>
}) {
  const present = useIsPresent()
  return (
    <motion.ul
      ref={ref}
      id={id}
      className={styles.steps}
      inert={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: ROW_ENTER }}
      exit={{ opacity: 0, transition: ROW_EXIT }}
    >
      {children}
    </motion.ul>
  )
}

interface StepItemProps extends RowActions, RowMotion {
  readonly step: Todo
  readonly disabled: boolean
  readonly refocus: boolean
  readonly reopenLeaves: boolean
  /** Set by `AnimatePresence`, which takes the step out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/**
 * A step: a row like its todo's, without a move button. Steps stay where they are when they are done,
 * and are dragged among their todo's steps the way a todo is among the todos.
 */
function StepItem({
  step,
  disabled,
  refocus,
  reopenLeaves,
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
  const present = useIsPresent()

  return (
    <motion.li
      ref={setItem}
      className={styles.step}
      data-todo
      data-step
      data-status={step.status}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      data-leaving={!present || undefined}
      inert={!present}
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
        refocus={refocus}
        reopenLeaves={reopenLeaves}
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
 * The step being written, last among the steps: a step's row with the field in place of the text. The
 * row stays while step after step is added, sliding down under each; only the field starts afresh.
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
        {/* The slot at the row's start, so the box lines up with the steps above. */}
        <span className={styles.slot} aria-hidden="true" />
        <DoneCheckbox checked={false} size="sm" />
        <div className={styles.label}>
          <StepDraft key={draft} first={first} onAdd={onAdd} onClose={onClose} />
        </div>
      </div>
    </motion.li>
  )
}

interface StepSpaceProps {
  /** The todo's text, for the button's name. */
  readonly text: string
  readonly order: string
  /** The button, which the keyboard goes back to when the step editor it opened closes. */
  readonly buttonRef: Ref<HTMLButtonElement>
  /** Opens the step editor here. */
  readonly onStep: () => void
  /** Set by `AnimatePresence`, which takes the row out of the flow while it fades out. */
  readonly ref?: Ref<HTMLLIElement>
}

/**
 * The last line of an open todo's steps, all one button that opens the step editor there. It is not a
 * row: nothing is dropped on it, and a row dragged over it goes to the end of the steps above or before
 * the todo below, by the half it is over (rowDrag.ts).
 */
function StepSpace({ text, order, buttonRef, onStep, ref }: StepSpaceProps) {
  return (
    <motion.li
      ref={ref}
      className={[styles.step, styles.stepSpace].join(' ')}
      data-add-step
      layout="position"
      layoutDependency={order}
      transition={{ layout: ROW_LAYOUT }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.more}
        aria-label={`Add a step to ${text}`}
        // The step editor takes the keyboard itself.
        onClick={(event) => {
          if (!guarded(event)) onStep()
        }}
      >
        <Plus className={styles.moreIcon} size={14} strokeWidth={1.5} aria-hidden="true" />
        <span className={styles.moreWords} aria-hidden="true">
          Add a step
        </span>
      </button>
    </motion.li>
  )
}

interface TodoRowProps extends RowActions {
  readonly todo: Todo
  readonly editing: boolean
  readonly setEditing: (editing: boolean) => void
  /**
   * The text button, which the keyboard goes back to when an edit, or the step editor, is done. It is
   * the keyboard's handle for dragging the row too.
   */
  readonly textRef: RefObject<HTMLButtonElement | null>
  readonly handleRef: (element: Element | null) => void
  /** Whether the text takes the focus: see `useRefocus`. */
  readonly refocus?: boolean
  /** Whether a step is being written under the todo. */
  readonly drafting?: boolean
  /** Where the move button sends the todo. Steps have none: they go wherever their todo goes. */
  readonly move?: { readonly target: MoveTarget; readonly onMove: (id: string) => void }
  /** Sticks the todo, or unsticks it. Steps have none: they travel with their todo. */
  readonly stick?: {
    readonly today: DayKey
    readonly leaves: boolean
    readonly onToggle: (fromKeys: boolean) => void
  }
  /** Unticking it reopens a sticky on a past day, which then goes on to today. */
  readonly reopenLeaves?: boolean
  /** Opens the step editor under the todo. Steps have none: a step cannot have steps. */
  readonly onStep?: () => void
  /**
   * Whether the todo's steps are folded away, the id of their list, and what folds or unfolds them.
   * Steps have none.
   */
  readonly fold?: {
    readonly folded: boolean
    readonly stepsId: string
    readonly onToggle: () => void
    // Before the press blurs a step draft, whose close would fold the todo again under the click.
    readonly onPress: () => void
  }
}

const RIPE_DAYS = 28

/** How far a sticky todo's ribbon has ripened, 0 to 1: quick at first, then slower, then not at all. */
const ripeness = (days: number): number =>
  Math.round((Math.min(days, RIPE_DAYS) / RIPE_DAYS) ** 0.6 * 100) / 100

/** How long a row's text watches for the focus after a drop: its animations and the old row's exit. */
export const REFOCUS_MS = 1000

/**
 * After a keyboard drop that makes a todo a step or a step a todo, the old row keeps the focus while it
 * fades, and the library may hand it back there, so once it is gone the focus is nowhere. Only then does
 * the text in the new place take it. Returns the text's ref, which is the drag handle's too.
 */
function useRefocus(
  refocus: boolean,
  text: RefObject<HTMLButtonElement | null>,
  handleRef: (element: Element | null) => void
): (element: HTMLButtonElement | null) => void {
  useEffect(() => {
    if (!refocus) return
    const until = performance.now() + REFOCUS_MS
    let frame = requestAnimationFrame(function check() {
      const focused = document.activeElement
      if (focused === null || focused === document.body || !focused.isConnected) text.current?.focus()
      if (performance.now() < until) frame = requestAnimationFrame(check)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [refocus, text])

  return useCallback(
    (element: HTMLButtonElement | null) => {
      text.current = element
      handleRef(element)
    },
    [text, handleRef]
  )
}

/** One line of the list, a todo's or a step's: the slot, the box, the text and the buttons at the end. */
function TodoRow({
  todo,
  editing,
  setEditing,
  textRef: text,
  handleRef,
  refocus = false,
  drafting = false,
  move,
  stick,
  reopenLeaves = false,
  onStep,
  fold,
  onToggleDone,
  onRemove,
  onEdit
}: TodoRowProps) {
  const step = move === undefined
  const open = todo.status === 'open'
  // The count is read out with the toggle that shows it, as its description, and how to drag the row
  // with the text, its handle.
  const countId = useId()
  const keysId = useId()
  const { done, total } = stepProgress(todo)
  const counted = total > 0
  // The steps are folded away, and the figures after the text say how many there are.
  const shut = fold?.folded === true && counted
  const foldable = fold !== undefined && counted ? fold : undefined
  // Only an open todo moves and takes steps (an open step under a done todo would undo "done flows down").
  const rowMove = open ? move : undefined
  const rowStep = open ? onStep : undefined
  const rowStick = open ? stick : undefined
  const sticky = todo.sticky !== undefined
  const since =
    todo.sticky === undefined || stick === undefined ? undefined : sinceLine(todo.sticky.since, stick.today)
  const days =
    todo.sticky === undefined || stick === undefined ? undefined : daysSince(todo.sticky.since, stick.today)
  const sinceId = useId()
  // Off to today, it hands the keyboard on; otherwise it keeps it in the other list (DayCard.tsx).
  const toggleSticky = (fromKeys: boolean): void => {
    if (rowStick === undefined) return
    if (!rowStick.leaves) {
      rowStick.onToggle(fromKeys)
      return
    }
    leaveRow(row, fromKeys, () => {
      rowStick.onToggle(fromKeys)
    })
  }
  const setText = useRefocus(refocus, text, handleRef)
  // The row itself: its menu opens at its end from the keyboard, and a row that goes away hands the
  // keyboard on from it.
  const [row, setRow] = useState<HTMLDivElement | null>(null)

  // The row's menu, while it is open, and how it was opened. A card that leaves the front closes it.
  const [menu, setMenu] = useState<RowMenuOpen | null>(null)
  const front = use(RowMenusFront)
  if (!front && menu !== null) setMenu(null)

  const onTextKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    // Space picks the row up (TODO_SENSORS), and stops there. When the row cannot be picked up, as
    // while a step is written under its todo, it does nothing: only Enter edits.
    if (event.key === ' ') {
      event.preventDefault()
      return
    }
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    // A row the keyboard has picked up keeps the focus on its text; it is not deleted from there.
    if (event.currentTarget.closest('[data-sorting]') !== null) return
    event.preventDefault()
    // The keyboard goes on to the next row, as after the delete button.
    leaveRow(row, true, () => {
      onRemove(todo.id)
    })
  }

  // Shift+F10 and the context menu key open the row's menu, at its end.
  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (editing || drafting) return
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      setMenu({ from: 'keys' })
    }
  }

  return (
    <div
      ref={setRow}
      className={styles.row}
      data-row={todo.id}
      data-status={todo.status}
      data-age={open ? days : undefined}
      data-steps={counted || undefined}
      data-folded={shut || undefined}
      data-editing={editing || undefined}
      data-drafting={drafting || undefined}
      // While a step is written, a press on the row's empty end, where its buttons are out of reach,
      // leaves the focus in the step editor: it is a slow second click after "Add a step", not a way out.
      onMouseDown={(event) => {
        if (drafting && event.target === event.currentTarget) event.preventDefault()
      }}
      onKeyDown={onRowKeyDown}
      onClick={(event) => {
        if (!reopenLeaves || !(event.target instanceof HTMLInputElement)) return
        const todoRow = row
          ?.closest('li[data-todo]:not([data-step])')
          ?.querySelector<HTMLElement>(':scope > [data-row]')
        if (event.detail === 0) leaveRow(todoRow ?? null, true, ignore)
        else guardClicks(event)
      }}
      onContextMenu={(event) => {
        if (editing || drafting) return
        event.preventDefault()
        setMenu({ from: 'point', x: event.clientX, y: event.clientY })
      }}
    >
      {/* Folded steps are not on the page, so the arrow controls nothing then. */}
      {foldable !== undefined ? (
        <RowTip tip={foldable.folded ? 'Show steps' : 'Hide steps'}>
          <button
            type="button"
            className={[styles.slot, styles.fold].join(' ')}
            data-folded={foldable.folded || undefined}
            aria-label={`${foldable.folded ? 'Show' : 'Hide'} steps of ${todo.text}`}
            aria-expanded={!foldable.folded}
            aria-controls={foldable.folded ? undefined : foldable.stepsId}
            aria-describedby={countId}
            onPointerDown={foldable.onPress}
            onClick={(event) => {
              if (!guarded(event)) foldable.onToggle()
            }}
          >
            <ChevronDown className={styles.chevron} size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </RowTip>
      ) : (
        <span className={styles.slot} aria-hidden="true" />
      )}
      <DoneCheckbox
        checked={todo.status === 'done'}
        size={step ? 'sm' : 'md'}
        onChange={() => {
          onToggleDone(todo.id)
        }}
      />
      <div className={styles.label}>
        {editing && (
          <TodoEditor
            text={todo.text}
            label={step ? 'Edit step' : 'Edit todo'}
            onCommit={(next) => {
              onEdit(todo.id, next)
            }}
            onClose={(how) => {
              setEditing(false)
              // Escape and Enter leave the keyboard where it was; after a click elsewhere, it has moved on.
              if (how !== 'blur') requestAnimationFrame(() => text.current?.focus())
            }}
          />
        )}
        {/* A button, so Enter edits the text. It is the row's drag handle too (`dragWords.instructions`),
            and stays, hidden, while the text is edited, so the row always has its handle. */}
        <button
          ref={setText}
          type="button"
          className={styles.text}
          hidden={editing}
          data-todo-text
          data-todo-handle
          aria-label={`Edit ${todo.text}`}
          aria-describedby={keysId}
          onClick={(event) => {
            // The folded steps' figures show the steps when they are clicked: that is what they ask.
            if (event.target instanceof Element && event.target.closest('[data-figures]') !== null) {
              if (!guarded(event)) fold?.onToggle()
              return
            }
            setEditing(true)
          }}
          onKeyDown={onTextKeyDown}
        >
          <span className={styles.strike}>{todo.text}</span>
          {/* Joined to the last word, so the figures never go onto a line alone. */}
          {shut && '\u2060'}
          {shut && (
            <span
              className={styles.figures}
              data-figures
              data-complete={done === total || undefined}
              aria-hidden="true"
            >{`${String(done)}/${String(total)}`}</span>
          )}
        </button>
        <span id={keysId} hidden>
          {dragWords.instructions}
        </span>
      </div>
      {open && since !== undefined && days !== undefined && (
        <RowTip tip={since}>
          <span
            className={styles.age}
            data-age-mark
            aria-hidden="true"
            style={{ '--age': ripeness(days) } as CSSProperties}
          />
        </RowTip>
      )}
      {/* What else the row does, at its end, where the pointer or the keyboard brings it into view
          (TodoItem.module.css). Their room is always kept. */}
      {(rowMove !== undefined || rowStep !== undefined) && (
        <div className={styles.actions} inert={drafting}>
          {rowStick !== undefined && (
            <RowTip tip={since ?? 'Carry until done'}>
              <button
                type="button"
                className={[styles.action, styles.pin].join(' ')}
                aria-label={`Carry until done: ${todo.text}`}
                aria-pressed={sticky}
                aria-describedby={since === undefined ? undefined : sinceId}
                onClick={(event) => {
                  if (guarded(event)) return
                  guardClicks(event)
                  toggleSticky(event.detail === 0)
                }}
              >
                <Pin size={16} aria-hidden="true" />
              </button>
            </RowTip>
          )}
          {/* Hidden, its room kept, while the steps show: the button under them adds one then. */}
          {rowStep !== undefined && (
            <RowTip tip="Add a step">
              <button
                type="button"
                className={[styles.action, styles.add].join(' ')}
                aria-label={`Add a step to ${todo.text}`}
                // The step editor takes the keyboard itself.
                onClick={(event) => {
                  if (!guarded(event)) rowStep()
                }}
              >
                <ListPlus size={16} aria-hidden="true" />
              </button>
            </RowTip>
          )}
          {rowMove !== undefined && (
            <RowTip tip={`Move to ${rowMove.target.name}`}>
              <button
                type="button"
                className={styles.action}
                aria-label={`Move to ${rowMove.target.name}: ${todo.text}`}
                onClick={(event) => {
                  if (guarded(event)) return
                  guardClicks(event)
                  leaveRow(row, event.detail === 0, () => {
                    rowMove.onMove(todo.id)
                  })
                }}
              >
                <MoveIcon to={rowMove.target} size={16} aria-hidden="true" />
              </button>
            </RowTip>
          )}
        </div>
      )}
      {/* Any row is deleted, from the very end, the same place on every row, set apart from the rest. */}
      <div className={[styles.actions, styles.bin].join(' ')} inert={drafting}>
        <RowTip tip="Delete">
          <button
            type="button"
            className={styles.action}
            aria-label={`Delete ${todo.text}`}
            onClick={(event) => {
              if (guarded(event)) return
              guardClicks(event)
              leaveRow(row, event.detail === 0, () => {
                onRemove(todo.id)
              })
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </RowTip>
      </div>
      {counted && <StepWords id={countId} done={done} total={total} />}
      {rowStick !== undefined && since !== undefined && (
        <span id={sinceId} className={styles.visuallyHidden}>
          {since}
        </span>
      )}
      <RowMenu
        text={todo.text}
        row={row}
        open={menu}
        onOpen={setMenu}
        onStep={rowStep}
        stick={
          rowStick === undefined
            ? undefined
            : {
                sticky,
                onToggle: (fromKeys) => {
                  toggleSticky(fromKeys)
                }
              }
        }
        move={
          rowMove === undefined
            ? undefined
            : {
                name: rowMove.target.name,
                direction: rowMove.target.direction,
                onMove: () => {
                  rowMove.onMove(todo.id)
                }
              }
        }
        fold={foldable}
        onDelete={() => {
          onRemove(todo.id)
        }}
      />
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
 * A small copy of the dragged row: box, text and a todo's step count, so carried steps are seen to come
 * along; the row stays put, dimmed, until the drop. It sits beside the pointer, never over the row or line
 * aimed at, and flips at the list's edges rather than covering the pointer. A keyboard drag has no copy,
 * and the keyboard and screen readers keep the real row.
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
      <StepCount todo={todo} />
    </div>
  )
}

/**
 * A todo's done steps as figures on the drag copy, folded or not, since they come along. Only seen: the
 * copy is hidden from screen readers.
 */
function StepCount({ todo }: { readonly todo: Todo }) {
  const { done, total } = stepProgress(todo)
  if (total === 0) return null
  return (
    <span className={styles.count} data-complete={done === total || undefined}>
      {`${String(done)}/${String(total)}`}
    </span>
  )
}

/** Read out, not shown: "1 of 3 steps done" instead of "1 slash 3". */
function StepWords({
  id,
  done,
  total
}: {
  readonly id: string
  readonly done: number
  readonly total: number
}) {
  return (
    <span
      id={id}
      className={styles.visuallyHidden}
    >{`${String(done)} of ${String(total)} ${total === 1 ? 'step' : 'steps'} done`}</span>
  )
}
