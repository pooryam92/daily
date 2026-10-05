import { Accessibility, AutoScroller, StyleInjector } from '@dnd-kit/dom'
import { DragDropProvider } from '@dnd-kit/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { DayKey, Todo } from '@/domain/todo'
import { useSettledTodos } from '../todos/useSettledTodos'
import type { MoveTarget } from './copy'
import styles from './DayCard.module.css'
import { storedBefore } from './rowDrag'
import { useRowDrag } from './useRowDrag'
import { DraggedCopy, TODO_SENSORS, TodoItem } from '../todos/TodoItem'
import type { LeavingRows } from '../todos/TodoItem'

/*
 * The drag library adds its styles as a <style> element, which the built page's CSP only lets
 * through with the nonce of that build (vite.config.mts).
 */
const DRAG_PLUGINS = [StyleInjector.configure({ nonce: __STYLE_NONCE__ })]

/**
 * A todo's part in the key that says when rows are measured: its id, its steps' ids while they show,
 * and a mark while a step is written under it (only an open todo takes one), since both make it taller.
 */
const layoutKey = (todo: Todo, drafting: string | null): string => {
  const steps =
    todo.steps === undefined || todo.folded === true ? '' : `(${todo.steps.map((step) => step.id).join(' ')})`
  const draft = todo.status === 'open' && todo.id === drafting ? '+' : ''
  return `${todo.id}${steps}${draft}`
}

/** What every row of a card does, whichever list it is in. */
export interface ListRows {
  readonly day: DayKey
  readonly today: DayKey
  readonly isNew: (id: string) => boolean
  readonly animateEnter: boolean
  readonly moveTarget: MoveTarget
  readonly leaving: LeavingRows
  /** The todo whose text takes the focus once it has changed lists. */
  readonly refocus: string | null
  readonly onAdd: (text: string, parentId?: string) => void
  readonly onToggleDone: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
  readonly onMove: (id: string) => void
  readonly onToggleSticky: (id: string, fromKeys: boolean) => void
  readonly onPlace: (id: string, parentId?: string, beforeId?: string) => void
  readonly onToggleFold: (id: string) => void
}

interface TodoListProps {
  /** This list's todos, in stored order. */
  readonly todos: readonly Todo[]
  readonly rows: ListRows
  readonly dragging: boolean
  readonly setDragging: (dragging: boolean) => void
  readonly sticky?: boolean
}

/**
 * One list of a card's todos, sorted by dragging within it. A dragged row stays put while a copy follows
 * the pointer, and nothing else moves (useRowDrag.ts): a line, or a tint on a todo, shows where it would land.
 */
export function TodoList({ todos, rows, dragging, setDragging, sticky = false }: TodoListProps) {
  const { ordered, settled } = useSettledTodos(todos, dragging)
  // The todo a step is being written under, if any. It is kept here, not in the todo, because opening
  // and closing the step editor moves the rows below, which then have to be measured.
  const [drafting, setDrafting] = useState<string | null>(null)
  const order = ordered.map((todo) => layoutKey(todo, drafting)).join()
  const [list, setList] = useState<HTMLUListElement | null>(null)

  const place = (id: string, parentId?: string, beforeId?: string): void => {
    rows.onPlace(id, parentId, storedBefore(todos, settled, id, parentId, beforeId))
  }
  const { drop, line, refocus, said, handlers } = useRowDrag({
    ordered,
    settled,
    list,
    setDragging,
    onPlace: place
  })
  // The todo a row let go here would be a step of: into it, as its last step, or at a step's line,
  // whose todo may be scrolled out of view. A todo's line tints nothing.
  const tinted = drop?.line?.depth === 'todo' ? undefined : drop?.parentId

  return (
    <>
      <DragDropProvider
        // The card scrolls its list itself, only from the faded edges (useRowDrag.ts). Nor does
        // the library speak: it would name a row by its id and make its text a "draggable" toggle.
        // The text tells how to drag (TodoItem.tsx), and the card says what a drag does.
        plugins={(defaults) => [
          ...defaults.filter((plugin) => plugin !== AutoScroller && plugin !== Accessibility),
          ...DRAG_PLUGINS
        ]}
        sensors={TODO_SENSORS}
        {...handlers}
      >
        {/* `layoutScroll` lets the rows' layout animations account for how far the list is scrolled. */}
        <motion.ul
          ref={setList}
          className={[styles.todos, sticky ? styles.stickies : ''].join(' ')}
          data-sticky-list={sticky || undefined}
          layoutScroll
        >
          {/* `popLayout` takes a deleted row out of the flow at once, so the rows below close the gap
              while it fades instead of jumping up afterwards. */}
          <AnimatePresence mode="popLayout" initial={false} custom={rows.leaving}>
            {ordered.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                day={rows.day}
                today={rows.today}
                order={order}
                isNew={rows.isNew}
                animateEnter={rows.animateEnter}
                moveTarget={rows.moveTarget}
                onToggleDone={rows.onToggleDone}
                onRemove={rows.onRemove}
                onEdit={rows.onEdit}
                onMove={rows.onMove}
                onToggleSticky={rows.onToggleSticky}
                onAddStep={rows.onAdd}
                addingStep={drafting === todo.id}
                onToggleFold={rows.onToggleFold}
                dropTarget={tinted === todo.id}
                refocus={refocus ?? rows.refocus}
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
    </>
  )
}
