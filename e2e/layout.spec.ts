// The geometry is read in the page, which needs the DOM types the other e2e files do without.
/// <reference lib="dom" />

import { expect, test, todo, today } from './daily'
import type { Daily } from './daily'

const LONG = 'Set up continuous integration for the desktop build and the release pipeline on every platform'
const LONG_STEP =
  'Write the workflow file that builds, signs and uploads the installers for Linux, macOS and Windows'

test.use({
  seed: {
    [today]: [
      todo('Write the release notes', 'open', [todo('Draft'), todo('Proofread', 'done')]),
      todo(LONG, 'open', [todo(LONG_STEP), todo('Fix the lint errors', 'done'), todo('Cache')]),
      todo('Buy milk'),
      todo('Return the library book', 'done'),
      todo('Clean the house', 'done', [todo('Dust the shelves', 'done')])
    ]
  }
})

interface Box {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
}

/**
 * Where a row's parts are: the row, the label slot, the text button in it and where its words may go,
 * the text's lines, the box, the fold and its chevron, and the buttons at the row's end.
 */
interface Geometry {
  readonly row: Box
  readonly label: Box
  readonly text: Box
  /** The right edge of the room the words have: the text's content box, inside every padding. */
  readonly textEnd: number
  readonly box: Box
  readonly lines: readonly Box[]
  /** The chevron in the fold, shown or not. */
  readonly chevron: Box | null
  readonly toggle: Box | null
  /** Whether a click on the middle of the chevron lands on the toggle. */
  readonly chevronHitsToggle: boolean
  /** Move, Delete and Add a step, those the row has, shown or not, left to right. */
  readonly actions: readonly Box[]
  /** Where the row's parts other than the fold and the buttons end. */
  readonly end: number
}

function geometry(daily: Daily, text: string): Promise<Geometry> {
  return daily.page.getByRole('button', { name: `Edit ${text}`, exact: true }).evaluate((button, text) => {
    const box = ({ left, right, top, bottom, width }: DOMRect): Box => ({ left, right, top, bottom, width })
    const label = button.parentElement
    const row = label?.parentElement
    const strike = button.querySelector(':scope > span')
    const check = row?.querySelector(':scope > label')
    const toggle = row?.querySelector(`button[aria-label="Steps of ${text}"]`) ?? null
    const chevron = toggle?.querySelector('svg') ?? null
    const actions = [...(row?.querySelectorAll('button[aria-label]') ?? [])].filter((el) =>
      /^(Move|Delete|Add a step) /.test(el.getAttribute('aria-label') ?? '')
    )
    if (!label || !row || !strike || !check) throw new Error(`The row of ${text} is not as expected`)
    const ending = [toggle, ...actions].filter((el) => el !== null)
    // Hidden or not: Add a step keeps its room on an unfolded todo with steps.
    const rest = [...row.children].filter((el) => !ending.some((end) => el === end || el.contains(end)))
    // The words end where the innermost content box does, whichever element holds the padding.
    const inner = (el: Element) => {
      const style = getComputedStyle(el)
      return (
        el.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth)
      )
    }
    // In so small a window the add input may lie over the last lines until the list is scrolled.
    row.scrollIntoView({ block: 'center', behavior: 'instant' })
    const middle = chevron?.getBoundingClientRect()
    const hit =
      middle === undefined
        ? null
        : document.elementFromPoint(middle.left + middle.width / 2, middle.top + middle.height / 2)
    return {
      row: box(row.getBoundingClientRect()),
      label: box(label.getBoundingClientRect()),
      text: box(button.getBoundingClientRect()),
      textEnd: Math.min(inner(button), inner(label), inner(row)),
      box: box(check.getBoundingClientRect()),
      lines: [...strike.getClientRects()].map(box),
      chevron: chevron === null ? null : box(chevron.getBoundingClientRect()),
      toggle: toggle === null ? null : box(toggle.getBoundingClientRect()),
      chevronHitsToggle: toggle !== null && hit !== null && toggle.contains(hit),
      actions: actions.map((el) => box(el.getBoundingClientRect())).sort((a, b) => a.left - b.left),
      end: Math.max(...rest.map((el) => el.getBoundingClientRect().right))
    }
  }, text)
}

async function smallest(daily: Daily): Promise<void> {
  await daily.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(640, 420)
  })
  await expect
    .poll(() => daily.page.evaluate(() => [window.innerWidth, window.innerHeight]))
    .toEqual([640, 420])
}

/**
 * At the smallest window a long text wraps over several lines in a narrow column. Its words run up to
 * the room kept for the row's end, which nothing at rest or on hover takes from them, and the box sits
 * by the first line. Past the words only the 28px buttons (Add a step, Move, by the first line) and,
 * 16px on, the bin at the row's end may be. Before the box, a todo with steps has its fold (its
 * chevron 14px, by the first line) in the 20px slot at the row's start.
 */
test('in the smallest window, a wrapped row keeps its text wide, its box up, and its buttons at its end and its fold at its start', async ({
  daily
}) => {
  await smallest(daily)

  // The room kept at the end: Add a step, Move, the gap and the bin on every open todo; the bin alone on
  // any other row. The words' width follows: 244 on an open todo, 316 on a done one, 284 on a step.
  for (const [text, counted, buttons, room, width] of [
    [LONG, true, 3, 108, 244],
    [LONG_STEP, false, 1, 36, 284],
    ['Write the release notes', true, 3, 108, 244],
    ['Draft', false, 1, 36, 284],
    ['Buy milk', false, 3, 108, 244],
    ['Return the library book', false, 1, 36, 316],
    ['Clean the house', true, 1, 36, 316]
  ] as const) {
    const at = await geometry(daily, text)
    const first = at.lines[0]
    if (first === undefined) throw new Error(`${text} has no lines`)
    const where = `${text}: ${JSON.stringify(at)}`
    const middle = (part: Box) => (part.top + part.bottom) / 2
    const firstMiddle = middle(first)

    // The words have everything from the box to the room kept for the end, and nothing else takes any.
    const ends = at.actions
    const firstEnd = Math.min(...ends.map((part) => part.left))
    expect(at.textEnd, where).toBeLessThanOrEqual(firstEnd - 2 + 1)
    expect.soft(Math.abs(at.row.right - room - at.textEnd), where).toBeLessThanOrEqual(2)
    expect.soft(Math.abs(at.text.width - width), where).toBeLessThanOrEqual(2)
    // The text starts 4px after the box, which starts 4px after the 20px slot at the row's start.
    expect(Math.abs(at.text.left - at.box.right - 4), where).toBeLessThanOrEqual(1)
    for (const line of at.lines) {
      expect(Math.abs(line.left - first.left), where).toBeLessThanOrEqual(1)
      expect(line.right, where).toBeLessThanOrEqual(at.textEnd + 1)
    }
    expect(at.end, where).toBeLessThanOrEqual(firstEnd + 1)
    // The box is on the first line, not centred on the block.
    expect(Math.abs(at.box.top - (first.top - 4)), where).toBeLessThanOrEqual(1)

    // The buttons: 28px, by the first line, and the last thing on the row is at its end.
    expect(at.actions, where).toHaveLength(buttons)
    // From the end: the bin 4px in on every row; Move 48px in and Add a step 76px in on an open todo.
    const fromEnd = buttons === 3 ? [76, 48, 4] : [4]
    for (const [index, part] of at.actions.entries()) {
      expect(Math.abs(part.width - 28), where).toBeLessThanOrEqual(1)
      expect(Math.abs(part.top - (at.row.top + 4)), where).toBeLessThanOrEqual(1)
      expect.soft(Math.abs(at.row.right - part.right - (fromEnd[index] ?? 0)), where).toBeLessThanOrEqual(1)
    }
    const last = Math.max(...ends.map((part) => part.right))
    expect(last, where).toBeLessThanOrEqual(at.row.right + 1)
    expect(last, where).toBeGreaterThanOrEqual(at.row.right - 12)

    if (counted) {
      if (at.chevron === null) throw new Error(`${text} has no chevron`)
      if (at.toggle === null) throw new Error(`${text} has no fold`)
      // A 14px chevron by the first line however many lines the text takes, inside the fold, which is
      // first: 20×28 at the row's start, 4px before the box.
      expect(Math.abs(at.chevron.width - 14), where).toBeLessThanOrEqual(1)
      expect(at.toggle.left, where).toBeGreaterThanOrEqual(at.row.left - 1)
      expect(Math.abs(at.toggle.width - 20), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.toggle.bottom - at.toggle.top - 28), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.box.left - at.toggle.right - 4), where).toBeLessThanOrEqual(1)
      expect(Math.abs(middle(at.chevron) - firstMiddle), where).toBeLessThanOrEqual(3)
      expect(at.chevronHitsToggle, where).toBe(true)
      expect(at.chevron.left, where).toBeGreaterThanOrEqual(at.toggle.left - 0.5)
      expect(at.chevron.right, where).toBeLessThanOrEqual(at.toggle.right + 0.5)
    } else {
      expect(at.chevron, where).toBeNull()
      expect(at.toggle, where).toBeNull()
    }
  }
  // The long ones do wrap, so the checks above are about a wrapped row.
  expect((await geometry(daily, LONG)).lines.length).toBeGreaterThanOrEqual(3)
  expect((await geometry(daily, LONG_STEP)).lines.length).toBeGreaterThanOrEqual(3)
})

test('in a wide window the words have 644px on an open todo, 716 on a done one and 684 on a step', async ({
  daily
}) => {
  await daily.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1268, 800)
  })
  await expect.poll(() => daily.page.evaluate(() => window.innerWidth)).toBe(1268)
  for (const [text, width] of [
    [LONG, 644],
    ['Write the release notes', 644],
    ['Buy milk', 644],
    ['Return the library book', 716],
    ['Clean the house', 716],
    ['Draft', 684],
    [LONG_STEP, 684]
  ] as const) {
    const at = await geometry(daily, text)
    expect(Math.abs(at.text.width - width), `${text}: ${JSON.stringify(at)}`).toBeLessThanOrEqual(2)
  }
})

test('in the smallest window, the space under the steps is 28px high, as wide as a step’s row, and all of it the add', async ({
  daily
}) => {
  await smallest(daily)

  for (const [text, step] of [
    ['Write the release notes', 'Draft'],
    [LONG, 'Cache']
  ] as const) {
    const steps = await geometry(daily, step)
    const spacer = daily.row(text).locator('li[data-add-step]')
    await spacer.scrollIntoViewIfNeeded()
    const at = await spacer.evaluate((row) => {
      const box = ({ left, right, top, bottom, width }: DOMRect): Box => ({ left, right, top, bottom, width })
      const list = row.closest('li[data-todo]')?.parentElement
      const add = row.querySelector('button')
      return {
        row: box(row.getBoundingClientRect()),
        add: add === null ? null : box(add.getBoundingClientRect()),
        overflows: [document.documentElement, list].some((el) => el && el.scrollWidth > el.clientWidth)
      }
    })
    const where = `${text}: ${JSON.stringify(at)}, its step: ${JSON.stringify(steps)}`

    expect(Math.abs(at.row.left - steps.row.left), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.row.right - steps.row.right), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.row.bottom - at.row.top - 28), where).toBeLessThanOrEqual(1)
    // The add is the whole space: from the step row's left to the row's end, 28 tall.
    if (at.add === null) throw new Error(`${text} has no add under its steps`)
    for (const edge of ['left', 'right', 'top', 'bottom'] as const)
      expect(Math.abs(at.add[edge] - at.row[edge]), `${edge}: ${where}`).toBeLessThanOrEqual(1)
    expect(at.overflows, where).toBe(false)
  }
})
