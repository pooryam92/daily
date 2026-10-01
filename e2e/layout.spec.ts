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
 * Where a row's parts are: the label slot, the text button in it, the text's lines, the count, the box,
 * and the toggle that lies over the count.
 */
interface Geometry {
  readonly row: Box
  readonly label: Box
  readonly text: Box
  readonly box: Box
  readonly lines: readonly Box[]
  readonly count: Box | null
  readonly toggle: Box | null
  /** Whether a click on the middle of the count lands on the toggle. */
  readonly countHitsToggle: boolean
  /** The first word after the label, `tomorrow` or `delete`, hidden or not. */
  readonly word: Box
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
    let word = label?.nextElementSibling
    if (word === toggle) word = word?.nextElementSibling
    if (!label || !row || !strike || !check || !word) throw new Error(`The row of ${text} is not as expected`)
    const count = button.querySelector(':scope > span + span')
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
      word: box(word.getBoundingClientRect())
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
 * the whole slot between the box and the words, the box must sit by its first line, and the count
 * must follow its last word, with the toggle over it and clear of the words.
 */
test('in the smallest window, a wrapped row keeps its text wide, its box up and its count after it', async ({
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
      if (at.count === null) throw new Error(`${text} has no count`)
      expect(Math.abs(at.count.left - (last.right + 12)), where).toBeLessThanOrEqual(1)
      expect(at.count.top, where).toBeGreaterThanOrEqual(last.top)
      expect(at.count.bottom, where).toBeLessThanOrEqual(last.bottom)
      // The toggle lies over the count on the last line, after the text and short of the words.
      if (at.toggle === null) throw new Error(`${text} has no toggle`)
      expect(at.countHitsToggle, where).toBe(true)
      expect(at.toggle.top, where).toBeLessThanOrEqual(last.top)
      expect(at.toggle.bottom, where).toBeGreaterThanOrEqual(last.bottom)
      expect(at.toggle.left, where).toBeGreaterThanOrEqual(last.right)
      expect(at.toggle.left, where).toBeLessThanOrEqual(at.count.left)
      expect(at.toggle.right, where).toBeGreaterThanOrEqual(at.count.right)
      expect(at.toggle.right, where).toBeLessThanOrEqual(at.word.left + 1)
      expect(at.toggle.right, where).toBeLessThanOrEqual(at.row.right + 1)
    } else {
      expect(at.count, where).toBeNull()
      expect(at.toggle, where).toBeNull()
    }
  }
  // The long ones do wrap, so the checks above are about a wrapped row.
  expect((await geometry(daily, LONG)).lines.length).toBeGreaterThanOrEqual(3)
  expect((await geometry(daily, LONG_STEP)).lines.length).toBeGreaterThanOrEqual(3)
})
