import { describe, expect, it } from 'vitest'
import type { Todo } from '@/domain/todo'
import { HYSTERESIS_PX, ZONE_EDGE, dragWords, dropAt, dropNear, rowText } from './rowDrag'
import type { Dragged, Drop, HeldRow, ShownRow } from './rowDrag'

// A day as it is shown: the open todos, then the settled ones.
const workflow: Todo = { id: 'workflow', text: 'Add the workflow file', status: 'open' }
const lint: Todo = { id: 'lint', text: 'Fix the lint errors', status: 'done' }
const milk: Todo = { id: 'milk', text: 'Buy milk', status: 'open' }
const ci: Todo = { id: 'ci', text: 'Set up CI', status: 'open', steps: [workflow, lint] }
const taxes: Todo = { id: 'taxes', text: 'Do the taxes', status: 'open' }
const plants: Todo = { id: 'plants', text: 'Water the plants', status: 'open' }
const rent: Todo = { id: 'rent', text: 'Pay the rent', status: 'done' }
const flight: Todo = {
  id: 'flight',
  text: 'Book the flight',
  status: 'done',
  steps: [{ id: 'dates', text: 'Pick the dates', status: 'done' }],
  folded: true
}
const ordered = [milk, ci, taxes, plants, rent, flight]
const settled: ReadonlySet<string> = new Set(['rent', 'flight'])

/** A todo held at `index` among the open todos, or a step held at `index` among its todo's steps. */
const todoAt = (id: string, index: number): HeldRow => ({ id, parentId: undefined, index })
const stepAt = (id: string, parentId: string, index: number): HeldRow => ({ id, parentId, index })

describe('rowText', () => {
  it('finds a todo’s text, and a step’s under its todo', () => {
    expect(rowText(ordered, todoAt('plants', 3))).toBe('Water the plants')
    expect(rowText(ordered, stepAt('lint', 'ci', 1))).toBe('Fix the lint errors')
    expect(rowText(ordered, stepAt('lint', 'milk', 0))).toBe('')
  })
})

/*
 * A card as measured at pick-up, every line 30px tall and touching the next, from the top of the list.
 * `trip` is folded; `rent` and `chores` are settled.
 */
const H = 30
const shownRows: readonly ShownRow[] = [
  ['milk'],
  ['ci'],
  ['workflow', 'ci'],
  ['lint', 'ci'],
  ['cache', 'ci'],
  ['taxes'],
  ['trip'],
  ['house'],
  ['dust', 'house'],
  ['mop', 'house'],
  ['plants'],
  ['rent'],
  ['chores'],
  ['laundry', 'chores'],
  ['iron', 'chores']
].map(([id = '', parentId], index) => ({ id, parentId, top: index * H, bottom: (index + 1) * H }))
const settledIds: ReadonlySet<string> = new Set(['rent', 'chores'])

const shownRow = (id: string): ShownRow => {
  const row = shownRows.find((entry) => entry.id === id)
  if (row === undefined) throw new Error(`no row ${id}`)
  return row
}
/** The height `at` of the way down a row. */
const yOf = (id: string, at: number) => shownRow(id).top + H * at

const todoRow = (id: string, hasSteps = false): Dragged => ({ id, parentId: undefined, hasSteps })
const stepRow = (id: string, parentId: string): Dragged => ({ id, parentId, hasSteps: false })

const dropOf = (dragged: Dragged, y: number) => dropAt(shownRows, settledIds, dragged, y)
/** Where a drop puts the row and how it shows, without the refusal. */
const placeOf = (drop: Drop) => ({ parentId: drop.parentId, beforeId: drop.beforeId, line: drop.line })

const line = (y: number, depth: 'todo' | 'step') => ({ y, depth })

describe('dropAt', () => {
  const milk = todoRow('milk')

  it('puts a todo above a row on its top band, below it on its bottom band, at the top level', () => {
    expect(placeOf(dropOf(milk, yOf('plants', 0.1)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'plants',
      line: line(shownRow('plants').top, 'todo')
    })
    expect(placeOf(dropOf(milk, yOf('taxes', 0.9)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'trip',
      line: line(shownRow('taxes').bottom, 'todo')
    })
    // Below a folded todo is the next todo: its steps are not shown.
    expect(placeOf(dropOf(milk, yOf('trip', 0.9)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'house',
      line: line(shownRow('trip').bottom, 'todo')
    })
  })

  it('puts a todo into a todo on its middle, as its last step, shown without a line', () => {
    for (const into of ['taxes', 'trip', 'house'])
      expect(placeOf(dropOf(milk, yOf(into, 0.5))), into).toStrictEqual({
        parentId: into,
        beforeId: undefined,
        line: undefined
      })
  })

  it('changes zones at ZONE_EDGE of a row’s height', () => {
    const at = (y: number) => placeOf(dropOf(milk, y)).line?.depth ?? 'into'
    const { top, bottom } = shownRow('taxes')
    expect([
      at(top + H * ZONE_EDGE - 0.5),
      at(top + H * ZONE_EDGE + 0.5),
      at(bottom - H * ZONE_EDGE - 0.5),
      at(bottom - H * ZONE_EDGE + 0.5)
    ]).toEqual(['todo', 'into', 'into', 'todo'])
  })

  it('puts a row below an unfolded todo with steps as its first step', () => {
    expect(placeOf(dropOf(milk, yOf('ci', 0.9)))).toStrictEqual({
      parentId: 'ci',
      beforeId: 'workflow',
      line: line(shownRow('ci').bottom, 'step')
    })
  })

  it('puts a row above or below a step among that todo’s steps, a step of another todo too', () => {
    expect(placeOf(dropOf(milk, yOf('lint', 0.1)))).toStrictEqual({
      parentId: 'ci',
      beforeId: 'lint',
      line: line(shownRow('lint').top, 'step')
    })
    expect(placeOf(dropOf(stepRow('lint', 'ci'), yOf('dust', 0.9)))).toStrictEqual({
      parentId: 'house',
      beforeId: 'mop',
      line: line(shownRow('dust').bottom, 'step')
    })
  })

  it('splits a step’s middle at its centre', () => {
    const dragged = stepRow('workflow', 'ci')
    expect(placeOf(dropOf(dragged, yOf('dust', 0.45)))).toStrictEqual({
      parentId: 'house',
      beforeId: 'dust',
      line: line(shownRow('dust').top, 'step')
    })
    expect(placeOf(dropOf(dragged, yOf('dust', 0.55)))).toStrictEqual({
      parentId: 'house',
      beforeId: 'mop',
      line: line(shownRow('dust').bottom, 'step')
    })
  })

  it('tells a step at the end of a todo from the todo after it by the line’s depth alone', () => {
    const end = placeOf(dropOf(milk, yOf('cache', 0.9)))
    const next = placeOf(dropOf(milk, yOf('taxes', 0.1)))
    expect(end).toStrictEqual({
      parentId: 'ci',
      beforeId: undefined,
      line: line(shownRow('cache').bottom, 'step')
    })
    expect(next).toStrictEqual({
      parentId: undefined,
      beforeId: 'taxes',
      line: line(shownRow('taxes').top, 'todo')
    })
  })

  it('takes a step out to any top-level gap', () => {
    expect(placeOf(dropOf(stepRow('lint', 'ci'), yOf('milk', 0.1)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'milk',
      line: line(0, 'todo')
    })
    expect(placeOf(dropOf(stepRow('dust', 'house'), yOf('house', 0.5)))).toStrictEqual({
      parentId: 'house',
      beforeId: undefined,
      line: undefined
    })
  })

  it('puts an open row at the end of the open part when it is over the settled rows, or below every row', () => {
    const end = { parentId: undefined, beforeId: 'rent', line: line(shownRow('rent').top, 'todo') }
    for (const dragged of [milk, stepRow('lint', 'ci')])
      for (const y of [yOf('rent', 0.5), yOf('chores', 0.1), yOf('laundry', 0.5), yOf('iron', 0.9), 20 * H])
        expect(placeOf(dropOf(dragged, y)), `${dragged.id} at ${String(y)}`).toStrictEqual(end)
  })

  it('never puts a todo with steps of its own into a todo: it takes the nearer half of the middle', () => {
    const ci = todoRow('ci', true)
    expect(placeOf(dropOf(ci, yOf('taxes', 0.4)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'taxes',
      line: line(shownRow('taxes').top, 'todo')
    })
    expect(placeOf(dropOf(ci, yOf('taxes', 0.6)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'trip',
      line: line(shownRow('taxes').bottom, 'todo')
    })
  })

  it('snaps a todo with steps of its own over a step to the nearer side of that step’s todo and its steps, and says why', () => {
    const ci = todoRow('ci', true)
    // Clean the house and its steps run from 210 to 300: the middle is 255.
    const before = {
      parentId: undefined,
      beforeId: 'house',
      line: line(shownRow('house').top, 'todo'),
      refused: 'steps'
    }
    const after = {
      parentId: undefined,
      beforeId: 'plants',
      line: line(shownRow('mop').bottom, 'todo'),
      refused: 'steps'
    }
    expect(dropOf(ci, yOf('dust', 0.1))).toStrictEqual(before)
    expect(dropOf(ci, yOf('dust', 0.45))).toStrictEqual(before)
    expect(dropOf(ci, yOf('mop', 0.1))).toStrictEqual(after)
    expect(dropOf(ci, yOf('mop', 0.9))).toStrictEqual(after)
  })

  it('puts a todo with steps of its own below a todo whose steps show after those steps', () => {
    expect(placeOf(dropOf(todoRow('ci', true), yOf('house', 0.9)))).toStrictEqual({
      parentId: undefined,
      beforeId: 'plants',
      line: line(shownRow('mop').bottom, 'todo')
    })
  })

  it('leaves a row where it is over itself', () => {
    for (const at of [0.1, 0.5, 0.9]) {
      expect(placeOf(dropOf(milk, yOf('milk', at))), `milk ${String(at)}`).toMatchObject({
        parentId: undefined,
        beforeId: 'ci'
      })
      expect(placeOf(dropOf(stepRow('lint', 'ci'), yOf('lint', at))), `lint ${String(at)}`).toMatchObject({
        parentId: 'ci',
        beforeId: 'cache'
      })
    }
  })

  it('moves a settled todo only among the settled ones, never into one', () => {
    const rent = todoRow('rent')
    expect(placeOf(dropOf(rent, yOf('chores', 0.9)))).toMatchObject({ parentId: undefined })
    expect(placeOf(dropOf(rent, yOf('chores', 0.5))).parentId).toBeUndefined()
    for (const y of [yOf('milk', 0.1), yOf('taxes', 0.5), yOf('dust', 0.5)]) {
      const { parentId, beforeId } = dropOf(rent, y)
      expect(parentId, String(y)).toBeUndefined()
      expect(beforeId === undefined || settledIds.has(beforeId), String(y)).toBe(true)
    }
  })

  it('moves a step of a settled todo only among its todo’s steps', () => {
    const laundry = stepRow('laundry', 'chores')
    for (const y of [yOf('milk', 0.1), yOf('lint', 0.5), yOf('rent', 0.5), yOf('iron', 0.9)])
      expect(dropOf(laundry, y).parentId, String(y)).toBe('chores')
    expect(placeOf(dropOf(laundry, yOf('iron', 0.9)))).toMatchObject({
      parentId: 'chores',
      beforeId: undefined
    })
  })
})

// Add-step A: the row that adds a step closes a todo's steps, and is never a target. Its upper half
// is a step at the end of that todo, its lower half the top level after the todo's block.
describe('dropAt over the row that adds a step', () => {
  // A todo's `end` is the bottom of its block: its steps, then the row that adds one.
  const row = (id: string, at: number, parentId?: string, end?: number): ShownRow => ({
    id,
    parentId,
    top: at * H,
    bottom: (at + 1) * H,
    ...(end === undefined ? {} : { end: end * H })
  })
  const blockThenTodo = [
    row('milk', 0),
    row('ci', 1, undefined, 5),
    row('workflow', 2, 'ci'),
    row('lint', 3, 'ci'),
    row('taxes', 5),
    row('plants', 6)
  ]
  const blockLast = blockThenTodo.slice(0, 4)
  const none: ReadonlySet<string> = new Set()
  const milk = todoRow('milk')
  const place = (rows: readonly ShownRow[], dragged: Dragged, y: number) =>
    placeOf(dropAt(rows, none, dragged, y))

  it('puts a row on its upper half at the end of the todo’s steps', () => {
    for (const rows of [blockThenTodo, blockLast])
      for (const y of [4.1 * H, 4.4 * H])
        expect(place(rows, milk, y), String(y)).toStrictEqual({
          parentId: 'ci',
          beforeId: undefined,
          line: line(4 * H, 'step')
        })
  })

  it('puts a row on its lower half at the top level after the block: above the next todo, or at the end', () => {
    for (const y of [4.6 * H, 4.9 * H]) {
      expect(place(blockThenTodo, milk, y), String(y)).toStrictEqual({
        parentId: undefined,
        beforeId: 'taxes',
        line: line(5 * H, 'todo')
      })
      expect(place(blockLast, milk, y), String(y)).toStrictEqual({
        parentId: undefined,
        beforeId: undefined,
        line: line(5 * H, 'todo')
      })
    }
    // The free space under the last block is the end too, with the line under the block.
    expect(place(blockLast, milk, 8 * H)).toStrictEqual({
      parentId: undefined,
      beforeId: undefined,
      line: line(5 * H, 'todo')
    })
  })

  it('never puts a todo with steps of its own among the steps there', () => {
    const house = todoRow('house', true)
    for (const rows of [blockThenTodo, blockLast])
      for (const y of [4.1 * H, 4.4 * H, 4.6 * H, 4.9 * H])
        expect(place(rows, house, y).parentId, String(y)).toBeUndefined()
  })
})

// From uiux's §6: a zone changes only 2px past its edge, so the line doesn't flicker on an edge.
describe('dropNear', () => {
  const near = (dragged: Dragged, y: number, current: Drop | null) =>
    placeOf(dropNear(shownRows, settledIds, dragged, y, current))
  const plants = todoRow('plants')
  const milk = todoRow('milk')
  const holds = HYSTERESIS_PX - 0.5
  const goes = HYSTERESIS_PX + 0.5

  it('holds for 2px', () => {
    expect(HYSTERESIS_PX).toBe(2)
  })

  it('is the drop under the pointer while nothing shows yet', () => {
    for (let y = 0; y < shownRows.length * H + H; y++)
      for (const dragged of [plants, milk, stepRow('lint', 'ci'), todoRow('ci', true)])
        expect(near(dragged, y, null), `${dragged.id} at ${String(y)}`).toStrictEqual(
          placeOf(dropOf(dragged, y))
        )
  })

  it('keeps the place shown until the pointer is HYSTERESIS_PX past the edge of its zone, both ways', () => {
    const edge = shownRow('taxes').top + H * ZONE_EDGE
    const above = dropOf(plants, edge - 4)
    const into = dropOf(plants, edge + 4)
    expect(placeOf(above)).toMatchObject({ parentId: undefined, beforeId: 'taxes' })
    expect(placeOf(into)).toStrictEqual({ parentId: 'taxes', beforeId: undefined, line: undefined })

    expect(near(plants, edge + holds, above)).toStrictEqual(placeOf(above))
    expect(near(plants, edge + goes, above)).toStrictEqual(placeOf(into))
    expect(near(plants, edge - holds, into)).toStrictEqual(placeOf(into))
    expect(near(plants, edge - goes, into)).toStrictEqual(placeOf(above))

    const lower = shownRow('taxes').bottom - H * ZONE_EDGE
    const below = dropOf(plants, lower + 4)
    expect(placeOf(below)).toMatchObject({ parentId: undefined, beforeId: 'trip' })
    expect(near(plants, lower + holds, into)).toStrictEqual(placeOf(into))
    expect(near(plants, lower + goes, into)).toStrictEqual(placeOf(below))
    expect(near(plants, lower - holds, below)).toStrictEqual(placeOf(below))
    expect(near(plants, lower - goes, below)).toStrictEqual(placeOf(into))
  })

  it('keeps a step’s half the same way at its centre', () => {
    const centre = yOf('lint', 0.5)
    const above = dropOf(milk, centre - 4)
    const below = dropOf(milk, centre + 4)
    expect(placeOf(above)).toMatchObject({ parentId: 'ci', beforeId: 'lint' })
    expect(placeOf(below)).toMatchObject({ parentId: 'ci', beforeId: 'cache' })

    expect(near(milk, centre + holds, above)).toStrictEqual(placeOf(above))
    expect(near(milk, centre + goes, above)).toStrictEqual(placeOf(below))
    expect(near(milk, centre - holds, below)).toStrictEqual(placeOf(below))
    expect(near(milk, centre - goes, below)).toStrictEqual(placeOf(above))
  })

  it('lets go at once of a place the pointer is far from', () => {
    const above = dropOf(plants, yOf('taxes', 0.1))
    for (const y of [yOf('trip', 0.5), yOf('milk', 0.5), yOf('dust', 0.5), yOf('chores', 0.5)])
      expect(near(plants, y, above), String(y)).toStrictEqual(placeOf(dropOf(plants, y)))
  })
})

// From uiux's words table (drag-drop-ui-spec §7), not from the strings as built.
describe('dragWords', () => {
  const at = (dragged: Dragged, drop: Drop) => dragWords.at(ordered, settled, dragged, drop)
  const dropped = (dragged: Dragged, drop: Drop, text: string, days = ordered, done = settled) =>
    dragWords.dropped(days, done, dragged, drop, text)
  const todoLine = (beforeId: string | undefined): Drop => ({
    parentId: undefined,
    beforeId,
    line: { y: 0, depth: 'todo' }
  })
  const stepLine = (parentId: string, beforeId: string | undefined): Drop => ({
    parentId,
    beforeId,
    line: { y: 0, depth: 'step' }
  })
  const into = (parentId: string): Drop => ({ parentId, beforeId: undefined, line: undefined })
  const milkRow: Dragged = { id: 'milk', parentId: undefined, hasSteps: false }

  const row = (id: string, parentId?: string): Dragged => ({ id, parentId, hasSteps: false })

  it('tells the text how to edit, how to drag, and how to change levels', () => {
    expect(dragWords.instructions).toBe(
      'Press Enter to edit, Space to pick up. Up and Down arrows move it. Right arrow makes it a step of the ' +
        'todo above, Left arrow a todo again. Space drops it, Escape cancels.'
    )
  })

  it('names a todo by its text and its place among the open todos, or among the settled ones', () => {
    expect(dragWords.pickedUp(ordered, settled, todoAt('plants', 3), 'Water the plants')).toBe(
      'Picked up Water the plants, 4 of 4.'
    )
    expect(dragWords.pickedUp(ordered, settled, todoAt('flight', 5), 'Book the flight')).toBe(
      'Picked up Book the flight, 2 of 2.'
    )
    expect(dragWords.pickedUp(ordered, settled, stepAt('workflow', 'ci', 0), 'Add the workflow file')).toBe(
      'Picked up Add the workflow file, step 1 of 2 of Set up CI.'
    )
  })

  it('says each place a row is held at, by the rows around it', () => {
    expect(at(milkRow, todoLine('taxes'))).toBe('Above Do the taxes.')
    expect(at(milkRow, into('taxes'))).toBe('Into Do the taxes.')
    expect(at(milkRow, stepLine('ci', 'workflow'))).toBe('Step of Set up CI, first.')
    expect(at(milkRow, stepLine('ci', 'lint'))).toBe('Step of Set up CI, after Add the workflow file.')
    expect(at(milkRow, stepLine('ci', undefined))).toBe('Step of Set up CI, after Fix the lint errors.')
    // A settled todo among the settled ones.
    expect(at(row('flight'), todoLine('rent'))).toBe('Above Pay the rent.')
  })

  it('says the only step of a todo without steps by the todo alone', () => {
    expect(at(milkRow, stepLine('taxes', undefined))).toBe('Step of Do the taxes.')
    // The last step of another todo is not where it was, though both are at an end.
    expect(at(row('lint', 'ci'), stepLine('taxes', undefined))).toBe('Step of Do the taxes.')
  })

  it('says the end of the open part as the last of the open todos, and the end of the list as the end', () => {
    expect(at(milkRow, todoLine('rent'))).toBe('Last of the open todos.')
    expect(at(row('lint', 'ci'), todoLine('rent'))).toBe('Last of the open todos.')
    expect(at(row('rent'), todoLine(undefined))).toBe('At the end.')
  })

  it('says a row’s own place, either boundary of it, as where it was', () => {
    expect(at(row('taxes'), todoLine('taxes'))).toBe('Where it was.')
    expect(at(row('taxes'), todoLine('plants'))).toBe('Where it was.')
    // The last open todo, and the last settled one.
    expect(at(row('plants'), todoLine('rent'))).toBe('Where it was.')
    expect(at(row('flight'), todoLine(undefined))).toBe('Where it was.')
    expect(at(row('workflow', 'ci'), stepLine('ci', 'workflow'))).toBe('Where it was.')
    expect(at(row('workflow', 'ci'), stepLine('ci', 'lint'))).toBe('Where it was.')
    expect(at(row('lint', 'ci'), stepLine('ci', undefined))).toBe('Where it was.')
  })

  it('says why a row is refused', () => {
    expect(dragWords.refused('steps')).toBe("Can't be a step: it has steps of its own.")
    expect(dragWords.refused('done')).toBe("Can't be a step: it's done.")
    expect(dragWords.refused('top')).toBe("Can't be a step: no todo above.")
    expect(dragWords.refused('parentDone')).toBe("Can't be a todo: its todo is done.")
  })

  it('says where a drop left the row in the words of the place, lower-cased', () => {
    expect(dropped(milkRow, todoLine('taxes'), 'Buy milk')).toBe('Dropped Buy milk, above Do the taxes.')
    expect(dropped(milkRow, into('taxes'), 'Buy milk')).toBe('Dropped Buy milk, into Do the taxes.')
    expect(dropped(milkRow, stepLine('ci', 'workflow'), 'Buy milk')).toBe(
      'Dropped Buy milk, step of Set up CI, first.'
    )
    expect(dropped(milkRow, stepLine('ci', 'lint'), 'Buy milk')).toBe(
      'Dropped Buy milk, step of Set up CI, after Add the workflow file.'
    )
    expect(dropped(milkRow, stepLine('taxes', undefined), 'Buy milk')).toBe(
      'Dropped Buy milk, step of Do the taxes.'
    )
    expect(dropped(milkRow, todoLine('rent'), 'Buy milk')).toBe('Dropped Buy milk, last of the open todos.')
    expect(dropped(row('rent'), todoLine(undefined), 'Pay the rent')).toBe(
      'Dropped Pay the rent, at the end.'
    )
  })

  it('says a row dropped at its own place is where it was', () => {
    expect(dropped(row('taxes'), todoLine('plants'), 'Do the taxes')).toBe(
      'Dropped Do the taxes where it was.'
    )
    expect(dropped(row('lint', 'ci'), stepLine('ci', undefined), 'Fix the lint errors')).toBe(
      'Dropped Fix the lint errors where it was.'
    )
  })

  it('says in a sentence of its own when the todo a row is dropped under is open again', () => {
    const done: Todo = { ...taxes, status: 'done' }
    const days = [milk, done, plants]
    expect(dropped(milkRow, into('taxes'), 'Buy milk', days, new Set())).toBe(
      'Dropped Buy milk, into Do the taxes. Do the taxes is open again.'
    )
    const doneCi: Todo = { ...ci, status: 'done', steps: [{ ...workflow, status: 'done' }, lint] }
    expect(dropped(milkRow, stepLine('ci', 'lint'), 'Buy milk', [milk, doneCi, plants], new Set())).toBe(
      'Dropped Buy milk, step of Set up CI, after Add the workflow file. Set up CI is open again.'
    )
    // A done row under a done todo leaves it done.
    const doneMilk: Todo = { ...milk, status: 'done' }
    expect(dropped(milkRow, into('taxes'), 'Buy milk', [doneMilk, done, plants], new Set())).toBe(
      'Dropped Buy milk, into Do the taxes.'
    )
  })

  it('says a row dropped where it was, and a cancelled row, are back', () => {
    expect(dragWords.stayed('Buy milk')).toBe('Dropped Buy milk where it was.')
    expect(dragWords.cancelled('Buy milk')).toBe('Cancelled: Buy milk is back where it was.')
  })
})
