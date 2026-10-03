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
      todo(LONG, 'open', [todo(LONG_STEP), todo('Fix the lint errors', 'done'), todo('Cache')])
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
 * Where a row's parts are: the label slot, the text button in it, the text's lines, the pie, the box,
 * and the toggle that lies over the pie.
 */
interface Geometry {
  readonly row: Box
  readonly label: Box
  readonly text: Box
  readonly box: Box
  readonly lines: readonly Box[]
  /** The pie that counts a todo's steps. */
  readonly count: Box | null
  readonly toggle: Box | null
  /** Whether a click on the middle of the pie lands on the toggle. */
  readonly countHitsToggle: boolean
  /** The first word after the label, `tomorrow` or `delete`, hidden or not. */
  readonly word: Box
  /** The + that adds a step, on an open todo with steps. */
  readonly plus: Box | null
  /** Where the row's parts other than the pie, its toggle and the + end, the words included. */
  readonly end: number
}

function geometry(daily: Daily, text: string): Promise<Geometry> {
  return daily.page.getByRole('button', { name: `Edit ${text}`, exact: true }).evaluate((button, text) => {
    const box = ({ left, right, top, bottom, width }: DOMRect): Box => ({ left, right, top, bottom, width })
    const label = button.parentElement
    const row = label?.parentElement
    const strike = button.querySelector(':scope > span')
    const check = row?.querySelector(':scope > label')
    const toggle =
      [...(row?.querySelectorAll(':scope > button') ?? [])].find(
        (el) => el.getAttribute('aria-label') === `Steps of ${text}`
      ) ?? null
    const count = row?.querySelector(':scope > [class*="_count_"]') ?? null
    const plus = row?.querySelector(`:scope > button[aria-label="Add a step to ${text}"]`) ?? null
    let word = label?.nextElementSibling
    while (word && (word === toggle || word === count || word === plus)) word = word.nextElementSibling
    if (!label || !row || !strike || !check || !word) throw new Error(`The row of ${text} is not as expected`)
    const rest = [...row.children].filter((el) => el !== toggle && el !== count && el !== plus)
    // In so small a window the add input may lie over the last lines until the list is scrolled.
    count?.scrollIntoView({ block: 'center', behavior: 'instant' })
    const middle = count?.getBoundingClientRect()
    const hit =
      middle === undefined
        ? null
        : document.elementFromPoint(middle.left + middle.width / 2, middle.top + middle.height / 2)
    return {
      row: box(row.getBoundingClientRect()),
      label: box(label.getBoundingClientRect()),
      text: box(button.getBoundingClientRect()),
      box: box(check.getBoundingClientRect()),
      lines: [...strike.getClientRects()].map(box),
      count: count === null ? null : box(count.getBoundingClientRect()),
      toggle: toggle === null ? null : box(toggle.getBoundingClientRect()),
      countHitsToggle: toggle !== null && hit !== null && toggle.contains(hit),
      word: box(word.getBoundingClientRect()),
      plus: plus === null ? null : box(plus.getBoundingClientRect()),
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
 * At the smallest window a long text wraps over several lines in a narrow column. It must still take
 * the whole slot between the box and the words, and the box must sit by its first line. A todo with
 * steps has its pie at the row's top right, with the toggle over it, and an open one its + just left
 * of the toggle; the text and the words end before them.
 */
test('in the smallest window, a wrapped row keeps its text wide, its box up and its pie at its end', async ({
  daily
}) => {
  await smallest(daily)

  for (const [text, counted] of [
    [LONG, true],
    [LONG_STEP, false],
    ['Write the release notes', true],
    ['Draft', false]
  ] as const) {
    const at = await geometry(daily, text)
    const first = at.lines[0]
    const last = at.lines.at(-1)
    if (first === undefined || last === undefined) throw new Error(`${text} has no lines`)
    const where = `${text}: ${JSON.stringify(at)}`

    // The slot is what the box and the words leave, and the text takes all of it. The gaps are 4px
    // after the box and before `tomorrow`, and 12px before `delete`, which a step's row starts with.
    const slot = at.word.left - at.box.right
    expect(at.label.width, where).toBeGreaterThanOrEqual(slot - 16)
    expect(Math.abs(at.text.width - at.label.width), where).toBeLessThanOrEqual(1)
    for (const line of at.lines) expect(Math.abs(line.left - at.text.left), where).toBeLessThanOrEqual(1)
    // The box and the words are on the first line, not centred on the block.
    expect(Math.abs(at.box.top - (first.top - 4)), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.word.top - at.box.top), where).toBeLessThanOrEqual(1)
    if (counted) {
      if (at.count === null) throw new Error(`${text} has no pie`)
      // A 16px pie 10px in from the row's top right, by the first line however many lines the text takes.
      expect(Math.abs(at.count.width - 16), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.row.right - 10 - at.count.right), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.count.top - (at.row.top + 10)), where).toBeLessThanOrEqual(1)
      expect(at.end, where).toBeLessThanOrEqual(at.row.right - 34 + 1)
      expect(at.count.left, where).toBeGreaterThanOrEqual(at.end)
      // The 28px toggle lies over the pie, centred on it, inside the row.
      if (at.toggle === null) throw new Error(`${text} has no toggle`)
      expect(at.countHitsToggle, where).toBe(true)
      expect(Math.abs(at.toggle.width - 28), where).toBeLessThanOrEqual(1)
      expect(
        Math.abs((at.toggle.left + at.toggle.right) / 2 - (at.count.left + at.count.right) / 2),
        where
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs((at.toggle.top + at.toggle.bottom) / 2 - (at.count.top + at.count.bottom) / 2),
        where
      ).toBeLessThanOrEqual(1)
      expect(at.toggle.right, where).toBeLessThanOrEqual(at.row.right + 1)
      // An open todo's + is 28px, just left of the toggle, and the text and the words end before it.
      if (at.plus === null) throw new Error(`${text} has no +`)
      expect(Math.abs(at.plus.width - 28), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.plus.right - at.toggle.left), where).toBeLessThanOrEqual(1)
      expect(Math.abs(at.plus.top - at.toggle.top), where).toBeLessThanOrEqual(1)
      expect(at.end, where).toBeLessThanOrEqual(at.plus.left + 1)
    } else {
      expect(at.plus, where).toBeNull()
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
