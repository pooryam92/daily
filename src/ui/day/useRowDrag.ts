import type { DragDropEventHandlers } from '@dnd-kit/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Todo } from '@/domain/todo'
import { locate } from '@/domain/todo-rules'
import { atOwnPlace, dragWords, dropNear, keyDrop, keyMove, keyStart, rowText, sameDrop } from './rowDrag'
import type { Depth, Dragged, Drop, KeyMove, KeyPlace, ShownRow } from './rowDrag'
import { REFOCUS_MS } from '../todos/TodoItem'

interface RowDragInput {
  readonly ordered: readonly Todo[]
  readonly settled: ReadonlySet<string>
  /** The card's list of todos, which the rows are measured in. */
  readonly list: HTMLUListElement | null
  readonly setDragging: (dragging: boolean) => void
  /** Puts the row `id` before `beforeId` among the steps of `parentId`, or the todos; see `placed`. */
  readonly onPlace: (id: string, parentId?: string, beforeId?: string) => void
}

export interface RowDrag {
  /** Where the row would land if it were let go now; none while it is held outside the list. */
  readonly drop: Drop | null
  /**
   * The drop's line, drawn in the list's container rather than the list so its faded edges do not fade
   * it. It starts at its dot, on the box of the row's new depth; none while scrolled out of view.
   */
  readonly line:
    { readonly top: number; readonly left: number; readonly width: number; readonly depth: Depth } | undefined
  /** The todo or step whose text takes the focus after a keyboard drop: see `useRefocus`. */
  readonly refocus: string | null
  /** What the drag says, for the card's live region. */
  readonly said: string
  readonly handlers: Pick<DragDropEventHandlers, 'onDragStart' | 'onDragMove' | 'onDragEnd'>
}

/**
 * How far past the list's top or bottom edge a held row scrolls the list at full speed: a row's height.
 * Nearer the edge it scrolls slower.
 */
const SCROLL_EDGE_PX = 36

/** How fast the list scrolls, in pixels a frame, at its fastest. */
const SCROLL_PX_PER_FRAME = 10

/**
 * Where a drop line's dot is centred from a todo row's left (TodoItem.module.css): padding 4px, start
 * slot 20px, gap 4px and half the box 14px. A step's box is its indent (32px) further in.
 */
const BOX_CENTRE_PX = { todo: 42, step: 74 } as const

/** How long a pointer holds a place before it is said, so that a sweep over the rows does not chatter. */
const SAY_AFTER_MS = 300

/** Half the drop line's dot (DayCard.module.css), which is centred on the box. */
const DOT_RADIUS_PX = 4

/** How far short of the row's right edge the line ends: the row's padding. */
const LINE_INSET_PX = 4

/** How far `element` is laid out below the top of `list`'s content: transforms, which animate, aside. */
function offsetIn(element: HTMLElement, list: HTMLElement): number {
  let top = 0
  let at: Element | null = element
  while (at instanceof HTMLElement && at !== list) {
    top += at.offsetTop
    at = at.offsetParent
  }
  return top
}

/** Where the list is in its container, and how far it is scrolled, while a row is held; the rows' left and right edges in it. */
interface View {
  readonly top: number
  readonly height: number
  readonly scroll: number
  readonly left: number
  readonly right: number
}

/** The drop line where it is drawn, none while its place is scrolled out of view. */
function lineFor(at: Drop['line'], view: View): RowDrag['line'] {
  if (at === undefined) return undefined
  const y = at.y - view.scroll
  if (y < 0 || y > view.height) return undefined
  const left = view.left + BOX_CENTRE_PX[at.depth] - DOT_RADIUS_PX
  return { top: view.top + y, left, width: view.right - LINE_INSET_PX - left, depth: at.depth }
}

/**
 * A row dragged on a card. The rows are measured once, at pick-up, in the list's own coordinates, so a
 * scroll moves the pointer over them and nothing else; where it is says where the row lands (`dropAt`).
 * Let go outside the list, it stays where it was.
 */
export function useRowDrag({ ordered, settled, list, setDragging, onPlace }: RowDragInput): RowDrag {
  const [drop, setDrop] = useState<Drop | null>(null)
  const [view, setView] = useState<View>({ top: 0, height: 0, scroll: 0, left: 0, right: 0 })
  const [refocus, setRefocus] = useState<string | null>(null)
  // Kept no longer than the row watches for it, or a later remount of the row (an undo) takes the focus.
  useEffect(() => {
    if (refocus === null) return
    const timer = setTimeout(() => {
      setRefocus(null)
    }, REFOCUS_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [refocus])
  const [said, setSaid] = useState('')
  // What the handlers share between renders: the library's events can come faster than the card renders.
  const held = useRef<Dragged | null>(null)
  const rows = useRef<readonly ShownRow[]>([])
  const pointer = useRef<{ readonly x: number; readonly y: number } | null>(null)
  const shown = useRef<Drop | null>(null)
  // The place a pointer holds, said once it has held it for a moment.
  const saying = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Whether a pointer has been told why the row snapped: once a drag is enough.
  const snapped = useRef(false)
  // Where the keyboard has the line, while the keyboard holds the row.
  const keyed = useRef<KeyPlace | null>(null)
  const frame = useRef(0)

  const show = (next: Drop | null): void => {
    if (sameDrop(next, shown.current)) return
    shown.current = next
    setDrop(next)
  }

  // A pointer's new place, said when it has held it for a moment, and why it snapped, at once.
  const showHeld = (next: Drop | null): void => {
    if (sameDrop(next, shown.current)) return
    show(next)
    clearTimeout(saying.current)
    const dragged = held.current
    if (next === null || dragged === null) return
    if (next.refused !== undefined && !snapped.current) {
      snapped.current = true
      setSaid(dragWords.refused(next.refused))
    }
    saying.current = setTimeout(() => {
      setSaid(dragWords.at(ordered, settled, dragged, next))
    }, SAY_AFTER_MS)
  }

  // The rows where they are laid out, not where they are drawn: a row still sliding or fading after
  // the last drop is measured at the place it is going to, and one on its way out not at all.
  const measure = (): readonly ShownRow[] => {
    if (list === null) return []
    const seen = new Set<string>()
    return [...list.querySelectorAll<HTMLElement>('[data-row]')].flatMap((element): ShownRow[] => {
      const id = element.dataset.row ?? ''
      const found = locate(ordered, id)
      const parentId = found?.parentId
      // A row that changed level is there twice for a moment: the old one leaves from the other level.
      const step = element.closest('li')?.hasAttribute('data-step') === true
      if (seen.has(id) || found === undefined || step !== (parentId !== undefined)) return []
      seen.add(id)
      const top = offsetIn(element, list)
      const row = { id, parentId, top, bottom: top + element.offsetHeight }
      // A todo's item holds its steps and the row that adds a step, under its own row.
      const item = parentId === undefined ? element.closest('li') : null
      return [item === null ? row : { ...row, end: offsetIn(item, list) + item.offsetHeight }]
    })
  }

  const dropFor = (x: number, y: number): Drop | null => {
    const dragged = held.current
    if (dragged === null || list === null) return null
    const box = list.getBoundingClientRect()
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) return null
    return dropNear(rows.current, settled, dragged, y - box.top + list.scrollTop, shown.current)
  }

  // The list scrolls, a frame at a time, only while the pointer is held past its top or bottom edge,
  // where a release would cancel: inside it, nothing moves away from a row the pointer is aiming at.
  const scrollFrame = (): void => {
    frame.current = requestAnimationFrame(scrollFrame)
    if (pointer.current === null || list === null) return
    const { x, y } = pointer.current
    const box = list.getBoundingClientRect()
    if (x < box.left || x > box.right) return
    const past = y > box.bottom ? y - box.bottom : y < box.top ? y - box.top : 0
    if (past === 0) return
    const speed = Math.max(Math.min(Math.abs(past) / SCROLL_EDGE_PX, 1) * SCROLL_PX_PER_FRAME, 1)
    // Instant, by the frame: the list's own smooth scrolling would restart every frame.
    list.scrollBy({ top: Math.sign(past) * speed, behavior: 'instant' })
  }
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      clearTimeout(saying.current)
    },
    []
  )

  // The keyboard does not move the copy, so the list is scrolled to show where the line is now.
  const reveal = (place: Drop): void => {
    if (list === null) return
    const into = rows.current.find((row) => row.id === place.parentId)
    const [top, bottom] =
      place.line === undefined ? [into?.top ?? 0, into?.bottom ?? 0] : [place.line.y, place.line.y]
    const view = {
      top: list.scrollTop + SCROLL_EDGE_PX,
      bottom: list.scrollTop + list.clientHeight - SCROLL_EDGE_PX
    }
    if (top < view.top) list.scrollTo({ top: top - SCROLL_EDGE_PX })
    else if (bottom > view.bottom) list.scrollTo({ top: bottom - list.clientHeight + SCROLL_EDGE_PX })
  }

  // Scrolls the list as little as it takes to show the row `id` where it is laid out, clear of the scroll
  // padding. Just after a drop the row that left its old level may still be there too.
  const showRow = useEffectEvent((id: string, step: boolean): void => {
    if (list === null) return
    const row = [...list.querySelectorAll<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)].find(
      (element) => element.closest('li')?.hasAttribute('data-step') === step
    )
    if (row === undefined) return
    const padding = getComputedStyle(list)
    const top = offsetIn(row, list) - (parseFloat(padding.scrollPaddingTop) || 0)
    const bottom = offsetIn(row, list) + row.offsetHeight + (parseFloat(padding.scrollPaddingBottom) || 0)
    if (top < list.scrollTop) list.scrollTo({ top })
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight })
  })

  // A row let go with the pointer, shown once the list has it in its new place.
  const dropped = useRef<{ readonly id: string; readonly step: boolean } | null>(null)
  useEffect(() => {
    const row = dropped.current
    if (row === null) return
    dropped.current = null
    showRow(row.id, row.step)
  }, [ordered])

  // The list scrolls under a pointer that holds still past its edges: the pointer is then over
  // other rows.
  const onScroll = useEffectEvent(() => {
    if (held.current !== null && list !== null) setView((current) => ({ ...current, scroll: list.scrollTop }))
    if (pointer.current !== null) showHeld(dropFor(pointer.current.x, pointer.current.y))
  })
  useEffect(() => {
    if (list === null) return
    const scrolled = (): void => {
      onScroll()
    }
    list.addEventListener('scroll', scrolled, { passive: true })
    return () => {
      list.removeEventListener('scroll', scrolled)
    }
  }, [list])

  const handlers: RowDrag['handlers'] = {
    onDragStart: ({ operation }) => {
      const id = String(operation.source?.id)
      const found = locate(ordered, id)
      if (found === undefined) return
      const dragged = { id, parentId: found.parentId, hasSteps: found.todo.steps !== undefined }
      held.current = dragged
      rows.current = measure()
      dropped.current = null
      if (list !== null) {
        const box = list.getBoundingClientRect()
        const todo = list.querySelector('[data-todo] > [data-row]')?.getBoundingClientRect()
        setView({
          top: list.offsetTop,
          height: list.clientHeight,
          scroll: list.scrollTop,
          left: list.offsetLeft + (todo?.left ?? box.left) - box.left,
          right: list.offsetLeft + (todo?.right ?? box.right) - box.left
        })
      }
      setDragging(true)
      setRefocus(null)
      const text = found.todo.text
      setSaid(dragWords.pickedUp(ordered, settled, { ...dragged, index: found.index }, text))
      if (operation.activatorEvent instanceof KeyboardEvent) {
        // Picked up from the keyboard, it is shown where it is.
        pointer.current = null
        keyed.current = keyStart(rows.current, settled, dragged)
        show(keyDrop(rows.current, settled, dragged, keyed.current))
        return
      }
      keyed.current = null
      snapped.current = false
      pointer.current = operation.position.current
      show(dropFor(pointer.current.x, pointer.current.y))
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(scrollFrame)
    },

    onDragMove: (event) => {
      const { nativeEvent } = event
      if (nativeEvent instanceof KeyboardEvent) {
        // The copy stays over the row: the keyboard moves the line, from place to place.
        event.preventDefault()
        const dragged = held.current
        const { by } = event
        if (dragged === null || keyed.current === null || by === undefined) return
        const move: KeyMove = by.y < 0 ? 'up' : by.y > 0 ? 'down' : by.x < 0 ? 'left' : 'right'
        const next = keyMove(rows.current, settled, dragged, keyed.current, move)
        keyed.current = next.place
        const place = keyDrop(rows.current, settled, dragged, next.place)
        show(place)
        if (place !== null) reveal(place)
        if (next.refused !== undefined) setSaid(dragWords.refused(next.refused))
        else if (place !== null) setSaid(dragWords.at(ordered, settled, dragged, place))
        return
      }
      if (!(nativeEvent instanceof PointerEvent)) return
      pointer.current = { x: nativeEvent.clientX, y: nativeEvent.clientY }
      showHeld(dropFor(nativeEvent.clientX, nativeEvent.clientY))
    },

    onDragEnd: ({ operation, canceled }) => {
      const dragged = held.current
      const place = shown.current
      held.current = null
      pointer.current = null
      keyed.current = null
      cancelAnimationFrame(frame.current)
      clearTimeout(saying.current)
      show(null)
      setDragging(false)
      if (dragged === null) return
      const text = rowText(ordered, dragged)
      if (canceled || place === null) {
        setSaid(dragWords.cancelled(text))
        return
      }
      setSaid(dragWords.dropped(ordered, settled, dragged, place, text))
      if (atOwnPlace(ordered, dragged, place)) return
      const byKeys = operation.activatorEvent instanceof KeyboardEvent
      // The row may be put in another list, where it is a new row whose text has to take the focus.
      if (byKeys) setRefocus(dragged.id)
      onPlace(dragged.id, place.parentId, place.beforeId)
      // A row let go into a todo whose steps unfold can land below what the list shows: once it is in
      // its new place, the list is scrolled just enough to show it. The keyboard's line showed it already.
      if (!byKeys) dropped.current = { id: dragged.id, step: place.parentId !== undefined }
    }
  }

  const line = lineFor(drop?.line, view)

  return { drop, line, refocus, said, handlers }
}
