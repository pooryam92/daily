import { Accessibility, AutoScroller, StyleInjector } from '@dnd-kit/dom'
import { DragDropProvider } from '@dnd-kit/react'
import { AnimatePresence, motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DayKey, Todo } from '@/domain/todo'
import { useSettledTodos } from '../todos/useSettledTodos'
import { CLEARED_LABEL, dayDetail, dayTitle, emptyDayLine, moveTarget } from './copy'
import type { MoveDirection } from './copy'
import { dayIndex, formatWeekday, fromDayKey } from '@/domain/dates'
import { deckTransform, deckZIndex } from '../deck/deck'
import { CLEARED, EMPTY_ENTER, QUICK_ADD_MS, ROW_ENTER, ROW_EXIT } from '../lib/motion'
import { dayProgress } from '@/domain/todo-rules'
import { AddTodoForm } from '../todos/AddTodoForm'
import styles from './DayCard.module.css'
import { ProgressRing } from './ProgressRing'
import { dragWords } from './rowDrag'
import { useRowDrag } from './useRowDrag'
import { DraggedCopy, TODO_SENSORS, TodoItem } from '../todos/TodoItem'

/**
 * The card's place in the deck once it is at rest: 0 is in front, ±1 sit behind it, the rest are
 * off-stage. Where the card is drawn follows `view`, which travels between those places.
 */
export type StackOffset = -3 | -2 | -1 | 0 | 1 | 2 | 3

interface DayCardProps {
  readonly day: DayKey
  readonly today: DayKey
  readonly offset: StackOffset
  /** Where the deck is looking, as a day index; see `useDeckView`. */
  readonly view: MotionValue<number>
  readonly todos: readonly Todo[]
  /** Adds a todo, or with `parentId`, a step at the end of that todo's steps. */
  readonly onAdd: (text: string, parentId?: string) => void
  readonly onToggleDone: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
  /** Move a todo to the day the card's move word names. */
  readonly onMove: (id: string) => void
  /**
   * Put the todo or step `id` just before `beforeId` among the steps of `parentId`, or without it,
   * among the todos; without `beforeId`, at the end.
   */
  readonly onPlace: (id: string, parentId?: string, beforeId?: string) => void
  /** Fold a todo's steps away, or show them again. */
  readonly onToggleFold: (id: string) => void
  /** Bring this card to the front. */
  readonly onSelect: () => void
}

/*
 * The drag library adds its styles as a <style> element, which the built page's CSP only lets
 * through with the nonce of that build (vite.config.mts).
 */
const DRAG_PLUGINS = [
  StyleInjector.configure({ nonce: __STYLE_NONCE__ }),
  // The library would name a dragged row by its id. It still tells how to drag; what a drag does is
  // said by the card, in the row's own words.
  Accessibility.configure({
    announcements: { dragstart: () => undefined, dragend: () => undefined },
    screenReaderInstructions: { draggable: dragWords.instructions }
  })
]

/**
 * A todo's part in the key that says when rows are measured: its id, and while its steps show (while
 * it is not folded), theirs, and a mark while a step is being written under it (only an open todo
 * takes one), since both make it taller.
 */
const layoutKey = (todo: Todo, drafting: string | null): string => {
  const steps =
    todo.steps === undefined || todo.folded === true ? '' : `(${todo.steps.map((step) => step.id).join(' ')})`
  const draft = todo.status === 'open' && todo.id === drafting ? '+' : ''
  return `${todo.id}${steps}${draft}`
}

/** A todo's bar in the glance is short, medium or long, like its text. */
const glanceLength = (text: string): 'short' | 'medium' | 'long' =>
  text.length < 16 ? 'short' : text.length < 36 ? 'medium' : 'long'

export function DayCard({
  day,
  today,
  offset,
  view,
  todos,
  onAdd,
  onToggleDone,
  onRemove,
  onEdit,
  onMove,
  onPlace,
  onToggleFold,
  onSelect
}: DayCardProps) {
  const inFront = offset === 0
  const target = moveTarget(day, today)

  // From frame to frame only transform and opacity change, which need neither layout nor paint
  // (z-index changes once per flip, where two cards swap).
  const index = dayIndex(day)
  const position = useTransform(view, (latest) => index - latest)
  const transform = useTransform(position, deckTransform)
  const zIndex = useTransform(position, deckZIndex)
  const opacity = useTransform(position, [-2, -1, 1, 2], [0, 1, 1, 0])
  // Depth is a tint towards the background (62% and 38% surface), and only the card in front is lifted.
  const shade = useTransform(position, [-2, -1, 0, 1, 2], [0.62, 0.38, 0, 0.38, 0.62])
  const lift = useTransform(position, [-1, 0, 1], [0, 1, 0])
  // The real content and the stand-in take turns, and neither shows at the halfway point where two
  // cards swap: a card arrives on top blank and fills in, instead of two layouts showing through each other.
  const content = useTransform(position, [-0.5, 0, 0.5], [0, 1, 0])
  const standIn = useTransform(position, [-1, -0.5, 0.5, 1], [1, 0, 0, 1])

  // Which side of the deck the card was on last. The card in front keeps it, so that its stand-in
  // fades out where it was instead of jumping to the other edge.
  const [side, setSide] = useState<'before' | 'after'>(offset < 0 ? 'before' : 'after')
  if (offset !== 0 && side !== (offset < 0 ? 'before' : 'after')) setSide(offset < 0 ? 'before' : 'after')

  const progress = useMemo(() => dayProgress(todos), [todos])
  // While a row is being dragged, nothing else may move the list.
  const [dragging, setDragging] = useState(false)
  const { ordered, settled } = useSettledTodos(todos, dragging)
  // The todo a step is being written under, if any. It is kept here, not in the todo, because opening
  // and closing the step editor moves the rows below, which then have to be measured.
  const [drafting, setDrafting] = useState<string | null>(null)
  const order = ordered.map((todo) => layoutKey(todo, drafting)).join()
  const [list, setList] = useState<HTMLUListElement | null>(null)

  const { drop, line, regrip, said, handlers } = useRowDrag({ ordered, settled, list, setDragging, onPlace })
  // The todo a row let go here would be a step of: into it, as its last step, or at a step's line,
  // whose todo may be scrolled out of view. A todo's line tints nothing.
  const tinted = drop?.line?.depth === 'todo' ? undefined : drop?.parentId

  // Todos and steps that were there when the card mounted are not new: they neither animate in nor scroll.
  const [initialIds] = useState(
    () => new Set(todos.flatMap((todo) => [todo.id, ...(todo.steps ?? []).map((step) => step.id)]))
  )
  const isNew = (id: string): boolean => !initialIds.has(id)
  // Animating every row of a quick run of additions would be noise, so only the first one does.
  // Steps count too: a list of them is typed one after another.
  const [animateEnter, setAnimateEnter] = useState(true)
  const lastAddedAt = useRef(Number.NEGATIVE_INFINITY)
  const add = (text: string, parentId?: string): void => {
    const now = performance.now()
    setAnimateEnter(now - lastAddedAt.current > QUICK_ADD_MS)
    lastAddedAt.current = now
    onAdd(text, parentId)
  }

  // Which way a moved row leaves (`LeavingRows`). Cleared once the todo is back, so a later delete only fades.
  const [leaving] = useState(() => new Map<string, MoveDirection>())
  const move = (id: string): void => {
    leaving.set(id, target.direction)
    onMove(id)
  }
  useEffect(() => {
    for (const id of leaving.keys()) if (todos.some((todo) => todo.id === id)) leaving.delete(id)
  }, [leaving, todos])

  return (
    // A card in the background is one big click target. That is a shortcut for mouse users only:
    // the arrow buttons and arrow keys do the same, so it needs no keyboard handling of its own.
    <motion.section
      className={styles.card}
      style={{ transform, zIndex, opacity }}
      data-offset={offset}
      data-side={side}
      data-today={day === today}
      // A row of the card's own is being dragged: the deck leaves sideways gestures to it meanwhile.
      data-sorting={dragging || undefined}
      aria-hidden={!inFront}
      onClick={inFront ? undefined : onSelect}
    >
      <motion.div className={styles.lift} style={{ opacity: lift }} />
      <motion.div className={styles.shade} style={{ opacity: shade }} />
      {/* What a card shows while it is behind, laid out in the strip the card in front leaves visible.
          The real header and list are hidden then: they are covered on one side or the other. */}
      <motion.div className={styles.behind} style={{ opacity: standIn }} aria-hidden>
        <div className={styles.tab}>
          <span className={styles.tabWeekday}>{formatWeekday(day)}</span>
          <span className={styles.tabDate}>{fromDayKey(day).getDate()}</span>
          {progress.total > 0 && (
            <span className={styles.tabRing}>
              <ProgressRing progress={progress} size="sm" />
            </span>
          )}
        </div>
        <ul className={styles.glance}>
          {ordered.map((todo) => (
            <li
              key={todo.id}
              className={styles.glanceBar}
              data-status={todo.status}
              data-length={glanceLength(todo.text)}
            />
          ))}
        </ul>
      </motion.div>
      <motion.div className={styles.content} style={{ opacity: content }} inert={!inFront}>
        <header className={styles.header}>
          {/* On the left, which day it is; on the right, where it stands. */}
          <div>
            <h1 className={styles.title}>{dayTitle(day, today)}</h1>
            <p className={styles.detail}>{dayDetail(day, today)}</p>
          </div>
          {/* How far along the day is and whether anything is left, over the column of checkboxes
              it sums up. A day without todos has no ring: there is nothing to be part-way through. */}
          <div className={styles.status}>
            {/* A live region has to be there before its text is, or the text is not announced. */}
            <span role="status">
              <AnimatePresence initial={false}>
                {progress.cleared && (
                  <motion.span
                    className={styles.cleared}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0, transition: CLEARED.label.on }}
                    exit={{ opacity: 0, transition: CLEARED.label.off }}
                  >
                    {CLEARED_LABEL}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <AnimatePresence initial={false}>
              {progress.total > 0 && (
                <motion.span
                  key="ring"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: ROW_ENTER }}
                  exit={{ opacity: 0, transition: ROW_EXIT }}
                >
                  <ProgressRing progress={progress} size="lg" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </header>

        <div className={styles.body}>
          <AnimatePresence initial={false}>
            {todos.length === 0 && (
              <motion.p
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: EMPTY_ENTER }}
                exit={{ opacity: 0, transition: ROW_EXIT }}
              >
                {emptyDayLine(day, today)}
              </motion.p>
            )}
          </AnimatePresence>

          {/* A dragged row stays in its place while a copy of it follows the pointer, and nothing
              else moves until it is let go (useRowDrag.ts): a line, or a tint on a todo, shows where
              it would land. */}
          <DragDropProvider
            // The card scrolls its list itself, only from the faded edges (useRowDrag.ts).
            plugins={(defaults) => [...defaults.filter((plugin) => plugin !== AutoScroller), ...DRAG_PLUGINS]}
            sensors={TODO_SENSORS}
            {...handlers}
          >
            {/* `layoutScroll` lets the rows' layout animations account for how far the list is scrolled. */}
            <motion.ul ref={setList} className={styles.todos} layoutScroll>
              {/* `popLayout` takes a deleted row out of the flow at once, so the rows below close the gap
                  while it fades instead of jumping up afterwards. */}
              <AnimatePresence mode="popLayout" initial={false} custom={leaving}>
                {ordered.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    order={order}
                    isNew={isNew}
                    animateEnter={animateEnter}
                    moveTarget={target}
                    onToggleDone={onToggleDone}
                    onRemove={onRemove}
                    onEdit={onEdit}
                    onMove={move}
                    onAddStep={add}
                    addingStep={drafting === todo.id}
                    onToggleFold={onToggleFold}
                    dropTarget={tinted === todo.id}
                    regrip={regrip}
                    onAddingStep={(open) => {
                      // Only the todo whose step editor is open closes it: another may have opened since.
                      setDrafting((current) => (open ? todo.id : current === todo.id ? null : current))
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
            {line !== undefined && (
              <div
                className={styles.dropLine}
                data-drop-line
                data-depth={line.depth}
                style={{ top: line.top, left: line.left, width: line.width }}
                aria-hidden="true"
              />
            )}
            <DraggedCopy ordered={ordered} bounds={list} />
          </DragDropProvider>
          {/* What a drag says. A region of its own, apart from the header's, which says "Cleared". */}
          <span role="status" className={styles.visuallyHidden}>
            {said}
          </span>
        </div>

        {inFront && <AddTodoForm onAdd={add} />}
      </motion.div>
    </motion.section>
  )
}
