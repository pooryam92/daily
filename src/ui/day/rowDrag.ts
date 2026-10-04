import type { Todo } from '@/domain/todo'
import { locate } from '@/domain/todo-rules'

/*
 * Where a dragged row would land. Nothing moves during a drag: the pointer is over the rows as measured
 * at pick-up. A row's top and bottom bands mean above and below it, shown as a line at the depth the row
 * would take; a todo's middle means into it, as its last step, shown as a tint.
 */

/** How much of a row's height, at its top and at its bottom, means above and below it. */
export const ZONE_EDGE = 0.25

/** The indent a drop line is drawn at: a todo's, or a step's. */
export type Depth = 'todo' | 'step'

/** A row as measured when the drag began: a todo's own line, or a step's. */
export interface ShownRow {
  readonly id: string
  /** The todo a step is under; none for a todo. */
  readonly parentId: string | undefined
  /** Its edges in list coordinates, from the top of the list's content. */
  readonly top: number
  readonly bottom: number
  /** For a todo, where it ends with its steps and the row that adds one, when it is measured. */
  readonly end?: number
}

export interface Dragged {
  readonly id: string
  readonly parentId: string | undefined
  /** Whether it is a todo with steps of its own, which therefore cannot be a step. */
  readonly hasSteps: boolean
}

/**
 * Why a row does not go where it is held, or an arrow would take it: it has steps of its own, it is
 * done, there is no todo above it, or the todo it is a step of is done.
 */
export type Refusal = 'steps' | 'done' | 'top' | 'parentDone'

/**
 * Where a drop puts the row: under `parentId` (none for the top level), before `beforeId` (none for the
 * end). Shown as a line at a gap, or without one as a tint on `parentId`, which it goes into last.
 */
export interface Drop {
  readonly parentId: string | undefined
  readonly beforeId: string | undefined
  readonly line: { readonly y: number; readonly depth: Depth } | undefined
  readonly refused?: Refusal
}

/**
 * The middle of the gap before the row at `index`. Past the last row it is the middle of what is left
 * of the last todo, the row that adds a step under its steps, or else the last row's bottom.
 */
function gapAt(rows: readonly ShownRow[], index: number): number {
  const before = rows[index - 1]
  const after = rows[index]
  if (after === undefined) {
    if (before === undefined) return 0
    const todoId = before.parentId ?? before.id
    const end = rows.find((row) => row.id === todoId)?.end ?? before.bottom
    return (before.bottom + Math.max(end, before.bottom)) / 2
  }
  return before === undefined ? after.top : (before.bottom + after.top) / 2
}

/**
 * Where the line for the gap before the row at `index` is drawn. Rows lie flush, so it is that row's top
 * edge, except after a todo's steps, where the row that adds a step lies between: a step's line goes over
 * that row, and a todo's under it.
 */
function lineAt(rows: readonly ShownRow[], index: number, depth: Depth): number {
  const before = rows[index - 1]
  const after = rows[index]
  const ends = depth === 'step' && after?.parentId === undefined
  if (after !== undefined && !(ends && before !== undefined)) return after.top
  if (depth === 'step' || before === undefined) return before?.bottom ?? 0
  // Past the end of the list, a todo's line goes under the last todo's steps and all.
  const todoId = before.parentId ?? before.id
  return rows.find((row) => row.id === todoId)?.end ?? before.bottom
}

/** Where the steps shown under the todo at `index` end: the index of the next row that is not one. */
function stepsEnd(rows: readonly ShownRow[], index: number): number {
  const id = rows[index]?.id
  let at = index + 1
  while (id !== undefined && rows[at]?.parentId === id) at++
  return at
}

/**
 * The drop for a pointer at height `y` in list coordinates, over `rows` in shown order. `settled` is the
 * todos shown below the others: an open row is never put among them, a settled todo moves only among
 * them, and a step of one only among its todo's steps.
 */
export function dropAt(
  rows: readonly ShownRow[],
  settled: ReadonlySet<string>,
  dragged: Dragged,
  y: number
): Drop {
  const todoOf = (row: ShownRow): string => row.parentId ?? row.id
  const isSettled = (index: number): boolean => {
    const row = rows[index]
    return row !== undefined && settled.has(todoOf(row))
  }
  // The first todo shown from `index` on, other than the dragged one.
  const todoFrom = (index: number): string | undefined =>
    rows.slice(index).find((row) => row.parentId === undefined && row.id !== dragged.id)?.id
  // The first step of `parentId` from `index` on, other than the dragged one.
  const stepFrom = (index: number, parentId: string): string | undefined => {
    for (let at = index; at < rows.length; at++) {
      const row = rows[at]
      if (row?.parentId !== parentId) return undefined
      if (row.id !== dragged.id) return row.id
    }
    return undefined
  }
  const todoGap = (index: number, refused?: Refusal): Drop => ({
    parentId: undefined,
    beforeId: todoFrom(index),
    line: { y: lineAt(rows, index, 'todo'), depth: 'todo' },
    ...(refused === undefined ? {} : { refused })
  })
  const stepGap = (index: number, parentId: string): Drop => ({
    parentId,
    beforeId: stepFrom(index, parentId),
    line: { y: lineAt(rows, index, 'step'), depth: 'step' }
  })
  // Before the todo at `index` or after its steps, whichever is nearer `y`.
  const aroundTodo = (index: number, refused?: Refusal): Drop => {
    const end = stepsEnd(rows, index)
    const top = rows[index]?.top ?? 0
    const bottom = rows[end - 1]?.bottom ?? top
    return y < (top + bottom) / 2 ? todoGap(index, refused) : todoGap(end, refused)
  }

  const zoneOf = (shown: ShownRow): 'above' | 'middle' | 'below' => {
    const height = shown.bottom - shown.top
    const at = height <= 0 ? 0.5 : (y - shown.top) / height
    if (at < ZONE_EDGE) return 'above'
    if (at > 1 - ZONE_EDGE) return 'below'
    return 'middle'
  }
  // Over a step of `parentId`: above it in its upper half, below it in its lower half.
  const stepAt = (index: number, step: ShownRow, parentId: string): Drop =>
    y < (step.top + step.bottom) / 2 ? stepGap(index, parentId) : stepGap(index + 1, parentId)

  const firstSettled = rows.findIndex((_, index) => isSettled(index))
  const openEnd = firstSettled === -1 ? rows.length : firstSettled
  // The row whose band holds `y`, none below the last row: a row reaches halfway into the gaps on
  // either side of it, and the first one up to the top of the list.
  const over = rows.findIndex((_, index) => y < gapAt(rows, index + 1))
  const row = rows[over]

  // A step of a settled todo stays among its todo's steps: at their start or end when it is held
  // anywhere else.
  if (dragged.parentId !== undefined && settled.has(dragged.parentId)) {
    const parent = rows.findIndex((entry) => entry.id === dragged.parentId)
    const end = stepsEnd(rows, parent)
    if (row?.parentId === dragged.parentId) return stepAt(over, row, dragged.parentId)
    return row !== undefined && over <= parent
      ? stepGap(parent + 1, dragged.parentId)
      : stepGap(end, dragged.parentId)
  }

  // A settled todo stays among the settled ones, and never goes into one.
  if (settled.has(dragged.id)) {
    if (row === undefined) return todoGap(rows.length)
    if (!isSettled(over)) return todoGap(openEnd)
    const refused = dragged.hasSteps ? 'steps' : 'done'
    if (row.parentId !== undefined) {
      return aroundTodo(
        rows.findIndex((entry) => entry.id === row.parentId),
        refused
      )
    }
    const zone = zoneOf(row)
    if (zone === 'above') return todoGap(over)
    if (zone === 'below') return todoGap(stepsEnd(rows, over))
    return aroundTodo(over, row.id === dragged.id ? undefined : refused)
  }

  // An open row stays among the open ones: over the settled ones, or below every row, it goes to the
  // end of the open part.
  if (row === undefined || isSettled(over)) return todoGap(openEnd)
  if (row.parentId !== undefined) {
    if (!dragged.hasSteps) return stepAt(over, row, row.parentId)
    // A todo with steps cannot be one: it goes before or after the todo the step is under.
    const parent = rows.findIndex((entry) => entry.id === row.parentId)
    return aroundTodo(parent, row.parentId === dragged.id ? undefined : 'steps')
  }
  const own = row.id === dragged.id
  const shows = rows[over + 1]?.parentId === row.id
  const zone = zoneOf(row)
  if (zone === 'middle' && !own && !dragged.hasSteps) {
    return { parentId: row.id, beforeId: undefined, line: undefined }
  }
  const upper = zone === 'above' || (zone === 'middle' && y < (row.top + row.bottom) / 2)
  if (upper) return todoGap(over, zone === 'middle' && !own ? 'steps' : undefined)
  // Below a todo whose steps show is its first step, the gap the eye sees there.
  if (shows && !own && !dragged.hasSteps) return stepGap(over + 1, row.id)
  if (shows) return todoGap(stepsEnd(rows, over), own ? undefined : 'steps')
  return todoGap(over + 1, zone === 'middle' && !own ? 'steps' : undefined)
}

/** The drop's `beforeId` in the stored order, where a done todo may come before open ones. */
export function storedBefore(
  todos: readonly Todo[],
  settled: ReadonlySet<string>,
  id: string,
  parentId: string | undefined,
  beforeId: string | undefined
): string | undefined {
  if (parentId !== undefined || beforeId === undefined || !settled.has(beforeId) || settled.has(id)) {
    return beforeId
  }
  const rest = todos.filter((todo) => todo.id !== id)
  return rest[rest.findLastIndex((todo) => !settled.has(todo.id)) + 1]?.id
}

/** How far past the edge of a zone the pointer goes before the drop changes: a pointer at rest on an edge would flicker. */
export const HYSTERESIS_PX = 2

/** Whether two drops put the row in the same place and show it the same way. */
export const sameDrop = (a: Drop | null, b: Drop | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.parentId === b.parentId &&
    a.beforeId === b.beforeId &&
    a.refused === b.refused &&
    a.line?.y === b.line?.y &&
    a.line?.depth === b.line?.depth)

/**
 * The drop for a pointer at height `y`, as `dropAt`, but one that `current` shows already holds
 * until the pointer is `HYSTERESIS_PX` past the edge of its zone.
 */
export function dropNear(
  rows: readonly ShownRow[],
  settled: ReadonlySet<string>,
  dragged: Dragged,
  y: number,
  current: Drop | null
): Drop {
  const next = dropAt(rows, settled, dragged, y)
  if (current === null || sameDrop(next, current)) return next
  const near = [y - HYSTERESIS_PX, y + HYSTERESIS_PX].some((at) =>
    sameDrop(dropAt(rows, settled, dragged, at), current)
  )
  return near ? current : next
}

/*
 * The keyboard walks the places the pointer reaches, one level at a time. A todo's up and down walk the
 * gaps between todos, so Space, up, Space still moves it up by one; right puts it into the todo above.
 * A step's walk the gaps between steps, on into the open todos around it; left makes it a todo just
 * after its todo. After a todo's last step one gap holds both levels, and left and right choose.
 */

export type KeyMove = 'up' | 'down' | 'left' | 'right'

/**
 * Where the keyboard has the line: at a gap between todos, at that gap but into the todo above it,
 * or at a gap between steps; `index` counts the gaps of that level, as `keyPlaces` lists them.
 */
export interface KeyPlace {
  readonly level: 'todo' | 'into' | 'step'
  readonly index: number
}

interface Gap {
  readonly drop: Drop
  /** The row the gap is before, as an index into the rows; past the end, their number. */
  readonly at: number
  /** For a gap between todos, the todo shown above it, other than the dragged one. */
  readonly above?: string
}

/** The gaps the keyboard walks, of both levels, in the order they are shown. */
function keyPlaces(
  rows: readonly ShownRow[],
  settled: ReadonlySet<string>,
  dragged: Dragged
): { readonly todos: readonly Gap[]; readonly steps: readonly Gap[] } {
  const self = rows.findIndex((row) => row.id === dragged.id)
  const part = settled.has(dragged.parentId ?? dragged.id)
  const inPart = (row: ShownRow): boolean => settled.has(row.parentId ?? row.id) === part
  // The dragged row's own place is the gap after it, but the line is shown above it, where it is.
  const after = dragged.parentId === undefined ? stepsEnd(rows, self) : self + 1
  const line = (at: number, depth: Depth): Drop['line'] => ({
    y: lineAt(
      rows,
      at === after && (depth === 'todo') === (dragged.parentId === undefined) ? self : at,
      depth
    ),
    depth
  })

  const tops = rows.flatMap((row, index) =>
    row.parentId === undefined && row.id !== dragged.id && inPart(row) ? [index] : []
  )
  const partEnd = part ? rows.length : rows.findIndex((row) => settled.has(row.parentId ?? row.id))
  const end = partEnd === -1 ? rows.length : partEnd
  const todos = [...tops, end].map((at, index): Gap => {
    const before = rows.slice(at).find((row) => row.parentId === undefined && row.id !== dragged.id)
    const above = tops[index - 1]
    return {
      drop: { parentId: undefined, beforeId: before?.id, line: line(at, 'todo') },
      at,
      ...(above === undefined ? {} : { above: rows[above]?.id })
    }
  })

  // A row with steps of its own is never a step. A step of a settled todo stays among its steps.
  if (dragged.hasSteps || (part && dragged.parentId === undefined)) return { todos, steps: [] }
  const parents = tops.filter((index) => {
    const id = rows[index]?.id
    return part ? id === dragged.parentId : rows[index + 1]?.parentId === id
  })
  const steps = parents.flatMap((parent): Gap[] => {
    const parentId = rows[parent]?.id
    if (parentId === undefined) return []
    const last = stepsEnd(rows, parent)
    const gaps: Gap[] = []
    for (let at = parent + 1; at < last; at++) {
      const step = rows[at]
      if (step !== undefined && step.id !== dragged.id)
        gaps.push({ drop: { parentId, beforeId: step.id, line: line(at, 'step') }, at })
    }
    return [...gaps, { drop: { parentId, beforeId: undefined, line: line(last, 'step') }, at: last }]
  })
  return { todos, steps }
}

/** Where the keyboard has the line as the row is picked up: at its own place. */
export function keyStart(
  rows: readonly ShownRow[],
  settled: ReadonlySet<string>,
  dragged: Dragged
): KeyPlace {
  const { todos, steps } = keyPlaces(rows, settled, dragged)
  const self = rows.findIndex((row) => row.id === dragged.id)
  if (dragged.parentId === undefined) {
    const after = stepsEnd(rows, self)
    return {
      level: 'todo',
      index: Math.max(
        0,
        todos.findIndex((gap) => gap.at >= after)
      )
    }
  }
  const index = steps.findIndex((gap) => gap.drop.parentId === dragged.parentId && gap.at > self)
  return { level: 'step', index: Math.max(0, index) }
}

export function keyDrop(
  rows: readonly ShownRow[],
  settled: ReadonlySet<string>,
  dragged: Dragged,
  place: KeyPlace
): Drop | null {
  const { todos, steps } = keyPlaces(rows, settled, dragged)
  if (place.level === 'step') return steps[place.index]?.drop ?? null
  const gap = todos[place.index]
  if (gap === undefined) return null
  if (place.level === 'todo') return gap.drop
  return { parentId: gap.above, beforeId: undefined, line: undefined }
}

/** Where an arrow key takes the line from `place`, or why it stays. */
export function keyMove(
  rows: readonly ShownRow[],
  settled: ReadonlySet<string>,
  dragged: Dragged,
  place: KeyPlace,
  move: KeyMove
): { readonly place: KeyPlace; readonly refused?: Refusal } {
  const { todos, steps } = keyPlaces(rows, settled, dragged)
  const walk = (level: 'todo' | 'step', index: number): { place: KeyPlace } => {
    const last = (level === 'todo' ? todos : steps).length - 1
    return { place: { level, index: Math.min(Math.max(index, 0), last) } }
  }
  const { level, index } = place
  if (level === 'step') {
    if (move === 'up') return walk('step', index - 1)
    if (move === 'down') return walk('step', index + 1)
    if (move === 'right') return { place }
    const parentId = steps[index]?.drop.parentId
    if (parentId !== undefined && settled.has(parentId)) return { place, refused: 'parentDone' }
    // Out to the top level, just after the todo it would have been a step of.
    const parent = rows.findIndex((row) => row.id === parentId)
    return walk(
      'todo',
      todos.findIndex((gap) => gap.at >= stepsEnd(rows, parent))
    )
  }
  if (level === 'into') {
    if (move === 'up') return walk('todo', index - 1)
    if (move === 'right') return { place }
    return { place: { level: 'todo', index } }
  }
  if (move === 'up') return walk('todo', index - 1)
  if (move === 'down') return walk('todo', index + 1)
  if (move === 'left') return { place }
  const above = todos[index]?.above
  if (settled.has(dragged.id)) return { place, refused: 'done' }
  if (dragged.hasSteps) return { place, refused: 'steps' }
  if (above === undefined) return { place, refused: 'top' }
  // Into the todo above, as its last step, shown as the tint on it whether its steps show or not.
  return { place: { level: 'into', index } }
}

/* What a drag on a card says, in the rows' own words. */

/** The row being dragged, where it is held now. */
export interface HeldRow {
  readonly id: string
  /** The todo a step is under; none for a todo. */
  readonly parentId: string | undefined
  /** Its place in its own list as it is held: among the todos of its part of the list, or its todo's steps. */
  readonly index: number
}

const textOf = (ordered: readonly Todo[], id: string | undefined): string =>
  ordered.find((todo) => todo.id === id)?.text ?? ''

const stepsOf = (ordered: readonly Todo[], id: string | undefined): readonly Todo[] =>
  ordered.find((todo) => todo.id === id)?.steps ?? []

export function rowText(ordered: readonly Todo[], row: Pick<HeldRow, 'id' | 'parentId'>): string {
  const found = locate(ordered, row.id)
  return found !== undefined && found.parentId === row.parentId ? found.todo.text : ''
}

/** The row's place as it is held, counted from 1 among the todos of its part of the list, or its todo's steps. */
function place(
  ordered: readonly Todo[],
  settled: ReadonlySet<string>,
  row: HeldRow
): { readonly n: number; readonly m: number } {
  if (row.parentId !== undefined) {
    return { n: row.index + 1, m: stepsOf(ordered, row.parentId).length }
  }
  const open = ordered.filter((todo) => !settled.has(todo.id)).length
  return settled.has(row.id)
    ? { n: row.index - open + 1, m: ordered.length - open }
    : { n: row.index + 1, m: open }
}

/** "2 of 5", or for a step "step 2 of 3". */
function countWords(ordered: readonly Todo[], settled: ReadonlySet<string>, row: HeldRow): string {
  const { n, m } = place(ordered, settled, row)
  return `${row.parentId === undefined ? '' : 'step '}${String(n)} of ${String(m)}`
}

const REFUSALS: Readonly<Record<Refusal, string>> = {
  steps: "Can't be a step: it has steps of its own.",
  done: "Can't be a step: it's done.",
  top: "Can't be a step: no todo above.",
  parentDone: "Can't be a todo: its todo is done."
}

/**
 * Where a drop puts the row, mid-sentence: "above Do the taxes", "into Set up CI", "step of Set up CI,
 * after Add the workflow". Rows are named as shown, without the dragged one.
 */
function whereWords(
  ordered: readonly Todo[],
  settled: ReadonlySet<string>,
  dragged: Dragged,
  drop: Drop
): string {
  const { parentId, beforeId } = drop
  if (drop.line === undefined) return `into ${textOf(ordered, parentId)}`
  if (parentId === undefined) {
    if (beforeId === undefined) return 'at the end'
    // An open row put before the first settled todo is shown last of the open ones.
    if (settled.has(beforeId) && !settled.has(dragged.parentId ?? dragged.id)) return 'last of the open todos'
    return `above ${textOf(ordered, beforeId)}`
  }
  const steps = stepsOf(ordered, parentId).filter((step) => step.id !== dragged.id)
  const at = beforeId === undefined ? steps.length : steps.findIndex((step) => step.id === beforeId)
  const parent = `step of ${textOf(ordered, parentId)}`
  if (steps.length === 0) return parent
  const previous = steps[at - 1]
  return previous === undefined ? `${parent}, first` : `${parent}, after ${previous.text}`
}

/**
 * Whether a drop leaves the row where it is: before itself or before the row shown after it, in the
 * same list. Let go there, nothing changes.
 */
export function atOwnPlace(ordered: readonly Todo[], dragged: Dragged, drop: Drop): boolean {
  if (drop.parentId !== dragged.parentId) return false
  const siblings = dragged.parentId === undefined ? ordered : stepsOf(ordered, dragged.parentId)
  const index = siblings.findIndex((row) => row.id === dragged.id)
  if (index === -1) return false
  if (drop.line === undefined) return dragged.parentId !== undefined && index === siblings.length - 1
  return drop.beforeId === dragged.id || drop.beforeId === siblings[index + 1]?.id
}

/** What a drag says, in the row's own words: never its id. */
export const dragWords = {
  instructions:
    'Press Enter to edit, Space to pick up. Up and Down arrows move it. Right arrow makes it a step of the ' +
    'todo above, Left arrow a todo again. Space drops it, Escape cancels.',

  pickedUp(ordered: readonly Todo[], settled: ReadonlySet<string>, row: HeldRow, text: string): string {
    const parent = row.parentId === undefined ? '' : ` of ${textOf(ordered, row.parentId)}`
    return `Picked up ${text}, ${countWords(ordered, settled, row)}${parent}.`
  },

  /** Where the row would go now, said as the keyboard moves it. */
  at(ordered: readonly Todo[], settled: ReadonlySet<string>, dragged: Dragged, drop: Drop): string {
    if (atOwnPlace(ordered, dragged, drop)) return 'Where it was.'
    const where = whereWords(ordered, settled, dragged, drop)
    return `${where.charAt(0).toUpperCase()}${where.slice(1)}.`
  },

  refused(reason: Refusal): string {
    return REFUSALS[reason]
  },

  dropped(
    ordered: readonly Todo[],
    settled: ReadonlySet<string>,
    dragged: Dragged,
    drop: Drop,
    text: string
  ): string {
    if (atOwnPlace(ordered, dragged, drop)) return dragWords.stayed(text)
    // An open row under a done todo reopens it: no done todo has an open step.
    const status = (id: string): string | undefined => locate(ordered, id)?.todo.status
    const reopens =
      drop.parentId !== undefined && status(dragged.id) === 'open' && status(drop.parentId) === 'done'
    const again = reopens ? ` ${textOf(ordered, drop.parentId)} is open again.` : ''
    return `Dropped ${text}, ${whereWords(ordered, settled, dragged, drop)}.${again}`
  },

  stayed(text: string): string {
    return `Dropped ${text} where it was.`
  },

  cancelled(text: string): string {
    return `Cancelled: ${text} is back where it was.`
  }
}
