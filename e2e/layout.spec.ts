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
 * the text's lines, the box, the pie, the fold that holds it, and the buttons at the row's end.
 */
interface Geometry {
  readonly row: Box
  readonly label: Box
  readonly text: Box
  /** The right edge of the room the words have: the text's content box, inside every padding. */
  readonly textEnd: number
  readonly box: Box
  readonly lines: readonly Box[]
  /** The pie that counts a todo's steps. */
  readonly count: Box | null
  readonly toggle: Box | null
  /** Whether a click on the middle of the pie lands on the toggle. */
  readonly countHitsToggle: boolean
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
    const count = row?.querySelector('[class*="_pie_"]') ?? null
    const actions = [...(row?.querySelectorAll('button[aria-label]') ?? [])].filter((el) =>
      /^(Move|Delete|Add a step) /.test(el.getAttribute('aria-label') ?? '')
    )
    if (!label || !row || !strike || !check) throw new Error(`The row of ${text} is not as expected`)
    const ending = [toggle, count, ...actions].filter((el) => el !== null)
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
    const middle = count?.getBoundingClientRect()
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
      count: count === null ? null : box(count.getBoundingClientRect()),
      toggle: toggle === null ? null : box(toggle.getBoundingClientRect()),
      countHitsToggle: toggle !== null && hit !== null && toggle.contains(hit),
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
 * by the first line. Past the words only the 28px buttons (Move, Add a step, by the first line), the
 * fold (its pie 16px, by the first line) and, 16px on, the bin at the row's end may be.
 */
test('in the smallest window, a wrapped row keeps its text wide, its box up, and its buttons and pie at its end', async ({
  daily
}) => {
  await smallest(daily)

  // The room kept at the end, besides the fold: Move, Add a step, the gap and the bin on an open todo;
  // the bin alone on any other row, and the gap too when a fold stands before it.
  for (const [text, counted, buttons, room] of [
    [LONG, true, 3, 108],
    [LONG_STEP, false, 1, 36],
    ['Write the release notes', true, 3, 108],
    ['Draft', false, 1, 36],
    ['Buy milk', false, 3, 108],
    ['Return the library book', false, 1, 36],
    ['Clean the house', true, 1, 52]
  ] as const) {
    const at = await geometry(daily, text)
    const first = at.lines[0]
    if (first === undefined) throw new Error(`${text} has no lines`)
    const where = `${text}: ${JSON.stringify(at)}`
    const middle = (part: Box) => (part.top + part.bottom) / 2
    const firstMiddle = middle(first)

    // The words have everything from the box to the room kept for the end, and nothing else takes any.
    const ends = [...at.actions, ...(at.toggle === null ? [] : [at.toggle])]
    const firstEnd = Math.min(...ends.map((part) => part.left))
    expect(at.textEnd, where).toBeLessThanOrEqual(firstEnd - 2 + 1)
    const cell = at.toggle === null ? 0 : at.toggle.width
    expect.soft(Math.abs(at.row.right - room - cell - at.textEnd), where).toBeLessThanOrEqual(2)
    for (const line of at.lines) {
      expect(Math.abs(line.left - first.left), where).toBeLessThanOrEqual(1)
      expect(line.right, where).toBeLessThanOrEqual(at.textEnd + 1)
    }
    expect(at.end, where).toBeLessThanOrEqual(firstEnd + 1)
    // The box is on the first line, not centred on the block.
    expect(Math.abs(at.box.top - (first.top - 4)), where).toBeLessThanOrEqual(1)

    // The buttons: 28px, by the first line, and the last thing on the row is at its end.
    expect(at.actions, where).toHaveLength(buttons)
    // From the end: the bin 4px in on every row; Add a step 48px in, or against the fold; Move before it.
    const fromEnd = buttons === 3 ? [76 + cell, 48 + cell, 4] : [4]
    for (const [index, part] of at.actions.entries()) {
      expect(Math.abs(part.width - 28), where).toBeLessThanOrEqual(1)
      expect(Math.abs(part.top - (at.row.top + 4)), where).toBeLessThanOrEqual(1)
      expect.soft(Math.abs(at.row.right - part.right - (fromEnd[index] ?? 0)), where).toBeLessThanOrEqual(1)
    }
    const last = Math.max(...ends.map((part) => part.right))
    expect(last, where).toBeLessThanOrEqual(at.row.right + 1)
    expect(last, where).toBeGreaterThanOrEqual(at.row.right - 12)

    if (counted) {
      if (at.count === null) throw new Error(`${text} has no pie`)
      if (at.toggle === null) throw new Error(`${text} has no fold`)
      // A 16px pie by the first line however many lines the text takes, inside the fold, which is last.
      expect(Math.abs(at.count.width - 16), where).toBeLessThanOrEqual(1)
      // The fold 48px from the end, 16px before the bin, 48px wide for one figure on each side of the slash.
      expect(Math.abs(at.row.right - 48 - at.toggle.right), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.toggle.width - 48), where).toBeLessThanOrEqual(1)
      expect(Math.abs(middle(at.count) - firstMiddle), where).toBeLessThanOrEqual(3)
      expect(at.countHitsToggle, where).toBe(true)
      expect(at.count.left, where).toBeGreaterThanOrEqual(at.toggle.left - 0.5)
      expect(at.count.right, where).toBeLessThanOrEqual(at.toggle.right + 0.5)
      const bin = at.actions.at(-1)
      if (bin === undefined) throw new Error(`${text} has no bin`)
      for (const part of at.actions.slice(0, -1)) {
        expect(part.right, where).toBeLessThanOrEqual(at.toggle.left + 1)
      }
      expect(Math.abs(bin.left - at.toggle.right - 16), where).toBeLessThanOrEqual(1)
    } else {
      expect(at.count, where).toBeNull()
      expect(at.toggle, where).toBeNull()
    }
  }
  // The long ones do wrap, so the checks above are about a wrapped row.
  expect((await geometry(daily, LONG)).lines.length).toBeGreaterThanOrEqual(3)
  expect((await geometry(daily, LONG_STEP)).lines.length).toBeGreaterThanOrEqual(3)
})

test('in the smallest window, the spacer under the steps is 20px high and as wide as a step’s row', async ({
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
      return {
        row: box(row.getBoundingClientRect()),
        overflows: [document.documentElement, list].some((el) => el && el.scrollWidth > el.clientWidth)
      }
    })
    const where = `${text}: ${JSON.stringify(at)}, its step: ${JSON.stringify(steps)}`

    expect(Math.abs(at.row.left - steps.row.left), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.row.right - steps.row.right), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.row.bottom - at.row.top - 20), where).toBeLessThanOrEqual(1)
    expect(at.overflows, where).toBe(false)
  }
})
