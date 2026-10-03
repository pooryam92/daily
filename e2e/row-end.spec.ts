// What shows on a row is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { day, expect, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Locator } from '@playwright/test'
import type { Todo } from '../src/domain/todo'

/*
 * R1: a row's actions are buttons at its end, shown on hover or keyboard focus, never moving anything:
 * "Move <T> to tomorrow" (or "to today" on another day), "Delete <T>", a gap, "Add a step to <T>", then
 * the steps' fold. An open todo has all three; a done todo and a step only Delete. At rest a plain row
 * ends in nothing, an unfolded one in its pie, a folded one in "›" and its count, in the same room, so
 * folding moves nothing either. Each button has a tip with its words: at once on keyboard focus, after
 * a moment's hover, never on touch. After Move or Delete the focus goes to the next row at the same
 * level, else the previous, else its todo (for a step) or "Add a todo". A right-click, Shift+F10 or the
 * ContextMenu key still opens the row's menu, which also folds.
 */
const workflow = todo('Add the workflow file', 'done')
const lint = todo('Fix the lint errors')
const cache = todo('Cache the dependencies')
const ci = todo('Set up CI', 'open', [workflow, lint, cache])
const milk = todo('Buy milk')
const offsite: Todo = {
  ...todo('Plan the offsite', 'open', [todo('Pick a date', 'done'), todo('Book the venue')]),
  folded: true
}
const notes = todo('Write the release notes')
const house = todo('Clean the house', 'done', [todo('Dust the shelves', 'done')])
const seed = [milk, ci, offsite, notes, house]
const texts = [
  'Buy milk',
  'Set up CI',
  'Add the workflow file',
  'Fix the lint errors',
  'Cache the dependencies',
  'Plan the offsite',
  'Write the release notes',
  'Clean the house'
]
/** What each row offers, in the order its buttons stand: the bin is always last. */
const offered = (text: string): string[] =>
  ['Buy milk', 'Set up CI', 'Plan the offsite', 'Write the release notes'].includes(text)
    ? [`Move ${text} to tomorrow`, `Add a step to ${text}`, `Delete ${text}`]
    : [`Delete ${text}`]
const withSteps = ['Set up CI', 'Plan the offsite', 'Clean the house']
/** Everything at a row's end, in the order it stands and Tab visits it: the fold just before the bin. */
const ending = (text: string): string[] => {
  const names = offered(text)
  if (!withSteps.includes(text)) return names
  return [...names.slice(0, -1), `Steps of ${text}`, ...names.slice(-1)]
}
/** The words of each button's tip, by the start of its name. */
const TIPS = [
  ['Move', 'Move to tomorrow'],
  ['Add a step', 'Add a step'],
  ['Steps of', 'Hide steps'],
  ['Delete', 'Delete']
] as const

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${locator.toString()} is not shown`)
  return box
}

const edit = (daily: Daily, text: string) =>
  daily.page.getByRole('button', { name: `Edit ${text}`, exact: true })

/** Points at `text`'s words. */
async function point(daily: Daily, text: string): Promise<void> {
  const words = await boxOf(daily.line(text).locator('[data-todo-text]').first())
  await daily.page.mouse.move(words.x + 8, words.y + 10)
}

/** The pointer off the card, and the focus in the field that adds a todo, as when nothing is done. */
async function rest(daily: Daily): Promise<void> {
  await daily.page.mouse.move(0, 0)
  await daily.input.focus()
}

/** How opaque the most opaque part of `locator` looks, counting opacity on every element up from it. */
const seen = (locator: Locator) =>
  locator.evaluate((element) => {
    const shown = (at: Element) => {
      let value = 1
      for (let up: Element | null = at; up !== null; up = up.parentElement) {
        const style = getComputedStyle(up)
        if (style.visibility === 'hidden' || style.display === 'none') return 0
        value *= Number(style.opacity)
      }
      return value
    }
    const leaves = [element, ...element.querySelectorAll('*')].filter((at) => at.childElementCount === 0)
    return Math.max(...leaves.map(shown))
  })
const hidden = (locator: Locator, message?: string) =>
  expect.poll(() => seen(locator), { message }).toBeLessThan(0.05)
const showing = (locator: Locator, message?: string) =>
  expect.poll(() => seen(locator), { message }).toBeGreaterThan(0.95)

/** The words that are seen in `locator`: text in elements bigger than a pixel, so not reader-only text. */
const words = (locator: Locator) =>
  locator.evaluate((element) => {
    const shown = (at: Element) => {
      let value = 1
      for (let up: Element | null = at; up !== null; up = up.parentElement) {
        const style = getComputedStyle(up)
        if (style.visibility === 'hidden' || style.display === 'none') return 0
        value *= Number(style.opacity)
      }
      return value
    }
    return [element, ...element.querySelectorAll('*')]
      .filter((el) => {
        const box = el.getBoundingClientRect()
        return box.width > 1 && box.height > 1 && shown(el) > 0.05
      })
      .flatMap((el) => [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE))
      .map((node) => node.textContent?.trim() ?? '')
      .filter((text) => text !== '')
      .join(' ')
  })

/** The aria-label of whatever has the focus, so a fading copy found by role cannot answer for it. */
const focused = (daily: Daily) =>
  daily.page.evaluate(() => {
    const at = document.activeElement
    return at?.getAttribute('aria-label') ?? at?.getAttribute('role') ?? at?.tagName ?? null
  })

/** Where every row's line, its parts, its text and its buttons are, rounded, on the card in front. */
const measure = (daily: Daily) =>
  daily.page.evaluate(() =>
    [...document.querySelectorAll('section[data-offset="0"] li[data-todo] > div, li[data-add-step]')].map(
      (row) =>
        [row, ...row.querySelectorAll(':scope > *, [data-todo-text], button')]
          // An open menu or a tip may put 1px focus guards about: they take no room.
          .filter((part) => {
            const { width, height } = part.getBoundingClientRect()
            return width > 1 || height > 1
          })
          .map((part) => {
            const { x, y, width, height } = part.getBoundingClientRect()
            return [x, y, width, height].map(Math.round).join(',')
          })
    )
  )

test.describe('a row’s end', () => {
  test.use({ seed: { [today]: seed } })

  test('an open todo has Move, Delete and Add a step; a done todo and a step only Delete; no ⋯, no title', async ({
    daily
  }) => {
    for (const text of texts) expect(await daily.actions(text), text).toEqual(offered(text))
    await expect(daily.page.locator('[aria-label^="Actions for "]')).toHaveCount(0)
    // The tips are the app's own, so the window's never doubles them.
    for (const text of texts) {
      for (const name of ending(text)) {
        const button = daily.button(text, name)
        if ((await button.count()) === 0) continue
        await expect(button, name).not.toHaveAttribute('title')
        if (name.startsWith('Steps of ')) continue
        // 28px square.
        const at = await boxOf(button)
        expect(Math.abs(at.width - 28), name).toBeLessThanOrEqual(1)
        expect(Math.abs(at.height - 28), name).toBeLessThanOrEqual(1)
      }
    }
    // They stand in that order, left to right: Move, Add a step and the fold flush, then 16px apart, the bin.
    for (const text of ['Set up CI', 'Buy milk', 'Clean the house']) {
      await point(daily, text)
      const at = await Promise.all(ending(text).map((name) => boxOf(daily.button(text, name))))
      const where = `${text}: ${JSON.stringify(at)}`
      for (const [index, box] of at.entries()) {
        const before = at[index - 1]
        if (before === undefined) continue
        const gap = index === at.length - 1 ? 16 : 0
        expect(Math.abs(box.x - (before.x + before.width) - gap), where).toBeLessThanOrEqual(1)
      }
    }

    // The bin stands in the same place on every row: 4px from the end, whatever the row is.
    const row = await boxOf(daily.line('Buy milk'))
    for (const text of texts) {
      const bin = await boxOf(daily.button(text, `Delete ${text}`))
      expect(Math.abs(row.x + row.width - 4 - (bin.x + bin.width)), text).toBeLessThanOrEqual(1)
    }
  })

  test('at rest nothing shows: a plain row ends empty, an unfolded one in its pie, a folded one in › and its count', async ({
    daily
  }) => {
    await rest(daily)
    for (const text of texts) {
      for (const name of offered(text)) await hidden(daily.button(text, name), name)
      // No words but its own, and a folded todo's count.
      const counted = text === 'Plan the offsite' ? `${text} 1/2` : text
      expect(await words(daily.line(text)), text).toBe(counted)
    }
    await expect(daily.chevron('Buy milk')).toHaveCount(0)
    await expect(daily.chevron('Write the release notes')).toHaveCount(0)
    // Unfolded: the pie, no words; folded: the count in words, read out as the steps done.
    expect(await words(daily.chevron('Set up CI'))).toBe('')
    expect(await seen(daily.chevron('Set up CI'))).toBeGreaterThan(0.95)
    expect(await words(daily.chevron('Clean the house'))).toBe('')
    expect(await words(daily.chevron('Plan the offsite'))).toBe('1/2')
    await expect(daily.chevron('Plan the offsite')).toHaveAccessibleDescription('1 of 2 steps done')

    // Folding swaps one for the other, both ways.
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => words(daily.chevron('Set up CI'))).toBe('1/3')
    await daily.chevron('Plan the offsite').click()
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(() => words(daily.chevron('Plan the offsite'))).toBe('')
  })

  test('pointed at or focused from the keyboard, a row shows its buttons, and only that row', async ({
    daily
  }) => {
    await rest(daily)
    await point(daily, 'Set up CI')
    for (const name of offered('Set up CI')) await showing(daily.button('Set up CI', name), name)
    // Not its steps, not the others.
    await hidden(daily.button('Fix the lint errors', 'Delete Fix the lint errors'))
    await hidden(daily.button('Buy milk', 'Delete Buy milk'))
    await point(daily, 'Fix the lint errors')
    await showing(daily.button('Fix the lint errors', 'Delete Fix the lint errors'))
    await hidden(daily.button('Set up CI', 'Delete Set up CI'))

    // A mouse click on the pie leaves the focus in the row, but not as keyboard focus.
    await rest(daily)
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toBeFocused()
    await daily.page.mouse.move(0, 0)
    await hidden(daily.button('Set up CI', 'Delete Set up CI'))
    // From the keyboard they show, the one focused and the others of its row.
    await daily.page.keyboard.press('Shift+Tab')
    await expect.poll(() => focused(daily)).toBe('Add a step to Set up CI')
    for (const name of offered('Set up CI')) await showing(daily.button('Set up CI', name), name)
    await hidden(daily.button('Buy milk', 'Delete Buy milk'))
    // On the text too.
    await edit(daily, 'Buy milk').focus()
    await daily.page.keyboard.press('Shift+Tab')
    await daily.page.keyboard.press('Tab')
    await expect(edit(daily, 'Buy milk')).toBeFocused()
    for (const name of offered('Buy milk')) await showing(daily.button('Buy milk', name), name)
  })

  test('the unfolded pie gains a › pointing down on hover or focus, in the room it already has', async ({
    daily
  }) => {
    /** The icons seen in the fold, left to right. */
    const marks = () =>
      daily.chevron('Set up CI').evaluate((button) => {
        const shown = (at: Element) => {
          let value = 1
          for (let up: Element | null = at; up !== null; up = up.parentElement) {
            const style = getComputedStyle(up)
            if (style.visibility === 'hidden' || style.display === 'none') return 0
            value *= Number(style.opacity)
          }
          return value
        }
        return [...button.querySelectorAll('svg')]
          .filter((el) => !el.parentElement?.closest('svg') && shown(el) > 0.5)
          .map((el) => Math.round(el.getBoundingClientRect().left))
          .sort((a, b) => a - b)
      })
    await rest(daily)
    const cell = await boxOf(daily.chevron('Set up CI'))
    const atRest = await marks()
    expect(atRest.length).toBeGreaterThanOrEqual(1)
    for (const how of ['pointed at', 'focused'] as const) {
      if (how === 'pointed at') await point(daily, 'Set up CI')
      else {
        await rest(daily)
        await daily.button('Set up CI', 'Add a step to Set up CI').focus()
        await daily.page.keyboard.press('Tab')
        await expect(daily.chevron('Set up CI')).toBeFocused()
      }
      await expect.poll(async () => (await marks()).length, how).toBe(atRest.length + 1)
      const shown = await marks()
      // The new one is before the pie, and the cell has not grown.
      expect(shown[0], how).toBeLessThan(atRest[0] ?? 0)
      expect(await boxOf(daily.chevron('Set up CI')), how).toEqual(cell)
    }
  })

  test('nothing moves when a row is pointed at, a button is focused, or its steps fold', async ({
    daily
  }) => {
    await rest(daily)
    const before = await measure(daily)
    for (const text of texts) {
      await point(daily, text)
      await daily.page.waitForTimeout(200)
      expect(await measure(daily), `pointing at ${text}`).toEqual(before)
    }
    await rest(daily)
    await edit(daily, 'Set up CI').focus()
    for (const name of ending('Set up CI')) {
      await daily.page.keyboard.press('Tab')
      await expect.poll(() => focused(daily)).toBe(name)
      await daily.page.waitForTimeout(200)
      expect(await measure(daily), `${name} focused`).toEqual(before)
    }

    // Folded or not, the fold keeps its room and the text its width.
    const ownLine = async (text: string) =>
      daily.line(text).evaluate((row) =>
        [row, ...row.querySelectorAll(':scope > *, [data-todo-text], button')]
          .filter((part) => part.getBoundingClientRect().width > 1)
          .map((part) => {
            const { x, y, width, height } = part.getBoundingClientRect()
            return [x, y, width, height].map(Math.round).join(',')
          })
      )
    await rest(daily)
    for (const text of ['Set up CI', 'Plan the offsite', 'Clean the house']) {
      const unfoldedOrNot = await ownLine(text)
      const cell = await boxOf(daily.chevron(text))
      await daily.chevron(text).click()
      await daily.page.mouse.move(0, 0)
      await daily.page.waitForTimeout(400)
      expect(await boxOf(daily.chevron(text)), `${text} folded or unfolded`).toEqual(cell)
      await daily.input.focus()
      expect(await ownLine(text), `${text} folded or unfolded`).toEqual(unfoldedOrNot)
    }
  })

  test('every fold stands in one column at the rows’ end, the same width folded or not', async ({
    daily
  }) => {
    await rest(daily)
    const ends = []
    for (const text of ['Set up CI', 'Plan the offsite', 'Clean the house']) {
      const cell = await boxOf(daily.chevron(text))
      const row = await boxOf(daily.line(text))
      ends.push(cell.x + cell.width)
      // 48px from the end: the bin's 4, its 28 and the 16 between them.
      expect(Math.abs(row.x + row.width - 48 - (cell.x + cell.width)), text).toBeLessThanOrEqual(1)
    }
    for (const end of ends)
      expect(Math.abs(end - (ends[0] ?? 0)), JSON.stringify(ends)).toBeLessThanOrEqual(1)
  })

  test('by keyboard the row is text, Move, Add a step, the fold, then the bin; Enter and Space press them', async ({
    daily
  }) => {
    const path = async (from: string, count: number) => {
      await edit(daily, from).focus()
      const on: (string | null)[] = []
      for (let i = 0; i < count; i++) {
        await daily.page.keyboard.press('Tab')
        on.push(await focused(daily))
      }
      return on
    }
    expect(await path('Set up CI', 4)).toEqual(ending('Set up CI'))
    expect(await path('Buy milk', 3)).toEqual(ending('Buy milk'))
    expect((await path('Buy milk', 4))[3]).not.toMatch(/Buy milk/)
    expect(await path('Fix the lint errors', 1)).toEqual(['Delete Fix the lint errors'])
    expect(await path('Clean the house', 2)).toEqual(['Steps of Clean the house', 'Delete Clean the house'])

    await edit(daily, 'Buy milk').focus()
    await daily.page.keyboard.press('Tab')
    await daily.page.keyboard.press('Enter')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [ci, offsite, notes, house], [day(1)]: [milk] })
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')

    await edit(daily, 'Write the release notes').focus()
    for (let i = 0; i < 3; i++) await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Delete Write the release notes')
    await daily.page.keyboard.press('Space')
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [ci, offsite, house], [day(1)]: [milk] })
    // The focus rule holds from the keyboard too.
    await expect.poll(() => focused(daily)).toBe('Edit Clean the house')
  })

  test('after Move or Delete the focus goes to the next todo, else the previous, else Add a todo', async ({
    daily
  }) => {
    await daily.act('Buy milk', 'Delete Buy milk')
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')
    // Undo puts it back and leaves the focus where it is.
    await daily.page.getByRole('button', { name: 'Undo' }).dispatchEvent('click')
    await expect(daily.row('Buy milk')).toBeVisible()
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')

    await daily.act('Set up CI', 'Move Set up CI to tomorrow')
    await expect.poll(() => focused(daily)).toBe('Edit Plan the offsite')
    // The last one has no next: the one before it.
    await daily.act('Clean the house', 'Delete Clean the house')
    await expect.poll(() => focused(daily)).toBe('Edit Write the release notes')
    await daily.act('Write the release notes', 'Delete Write the release notes')
    await expect.poll(() => focused(daily)).toBe('Edit Plan the offsite')
    await daily.act('Plan the offsite', 'Delete Plan the offsite')
    await expect.poll(() => focused(daily)).toBe('Edit Buy milk')
    // The only one left: Add a todo.
    await daily.act('Buy milk', 'Delete Buy milk')
    await expect.poll(() => focused(daily)).toBe('Add a todo')
    await expect(daily.input).toBeFocused()
  })

  test('after a step’s Delete the focus goes to the next step, else the previous, else its todo', async ({
    daily
  }) => {
    await daily.act('Fix the lint errors', 'Delete Fix the lint errors')
    await expect.poll(() => focused(daily)).toBe('Edit Cache the dependencies')
    await daily.act('Cache the dependencies', 'Delete Cache the dependencies')
    await expect.poll(() => focused(daily)).toBe('Edit Add the workflow file')
    await daily.act('Add the workflow file', 'Delete Add the workflow file')
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')
  })

  test('Delete or Backspace on a focused text still deletes', async ({ daily }) => {
    await edit(daily, 'Buy milk').focus()
    await daily.page.keyboard.press('Delete')
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [ci, offsite, notes, house] })
    await edit(daily, 'Fix the lint errors').focus()
    await daily.page.keyboard.press('Backspace')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [{ ...ci, steps: [workflow, cache] }, offsite, notes, house] })
    await expect(daily.menu).toHaveCount(0)
  })

  test('while a row is carried, no row shows its buttons, not even the one carried', async ({ daily }) => {
    const grip = daily.page.getByRole('button', { name: 'Reorder Set up CI', exact: true })
    // By keyboard: its grip has the focus, which would show them.
    await grip.focus()
    await daily.page.waitForTimeout(300)
    await daily.page.keyboard.press('Space')
    await expect(daily.page.locator('[data-sorting]').first()).toBeAttached()
    await expect(grip).toBeFocused()
    for (const name of offered('Set up CI')) await hidden(daily.button('Set up CI', name), `carried: ${name}`)
    await daily.page.keyboard.press('Escape')
    await expect(daily.page.locator('[data-sorting]')).toHaveCount(0)

    // By pointer, over another row.
    await daily.page.mouse.move(0, 0)
    const at = await boxOf(grip)
    await daily.page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
    await daily.page.mouse.down()
    await daily.page.mouse.move(at.x + at.width / 2 + 4, at.y + at.height / 2 + 4, { steps: 4 })
    await expect(daily.page.locator('[data-sorting]').first()).toBeAttached()
    const over = await boxOf(daily.line('Write the release notes').locator('[data-todo-text]').first())
    await daily.page.mouse.move(over.x + 20, over.y + over.height / 2, { steps: 8 })
    await daily.page.waitForTimeout(200)
    for (const text of ['Write the release notes', 'Set up CI']) {
      for (const name of offered(text))
        await hidden(daily.page.locator(`button[aria-label="${name}"]`).first(), `dragging: ${name}`)
    }
    await daily.page.keyboard.press('Escape')
    await daily.page.mouse.up()
    await expect(daily.page.locator('[data-sorting]')).toHaveCount(0)
  })
})

test.describe('after a pointer Move or Delete', () => {
  const five = ['One', 'Two', 'Three', 'Four', 'Five'].map((text) => todo(text))
  test.use({ seed: { [today]: five } })

  const card = (daily: Daily) => daily.page.locator('section[data-offset="0"]')
  /** What is left on disk, by text, once a moment has passed for a second click to have done harm. */
  const left = async (daily: Daily) => {
    await daily.page.waitForTimeout(700)
    const days = await daily.todos()
    return {
      today: (days[today] ?? []).map((entry) => entry.text),
      tomorrow: (days[day(1)] ?? []).map((entry) => entry.text)
    }
  }
  /** A click with the pointer held still where it is, counted as the `count`th of a run, as a double click's second is. */
  async function clickHere(daily: Daily, count: number): Promise<void> {
    await daily.page.mouse.down({ clickCount: count })
    await daily.page.mouse.up({ clickCount: count })
  }
  /** Points at `name` on `text`'s row and says where its middle is. */
  async function onto(daily: Daily, text: string, name: string): Promise<{ x: number; y: number }> {
    await point(daily, text)
    await showing(daily.button(text, name))
    const at = await boxOf(daily.button(text, name))
    const middle = { x: at.x + at.width / 2, y: at.y + at.height / 2 }
    await daily.page.mouse.move(middle.x, middle.y)
    return middle
  }

  for (const [verb, name, gone] of [
    ['the bin', (text: string) => `Delete ${text}`, 'deleted'],
    ['Move', (text: string) => `Move ${text} to tomorrow`, 'moved']
  ] as const) {
    for (const gap of [120, 400]) {
      test(`a double click on ${verb}, ${String(gap)}ms apart, takes one row, not the one that slides under it`, async ({
        daily
      }) => {
        await onto(daily, 'Two', name('Two'))
        await clickHere(daily, 1)
        await daily.page.waitForTimeout(gap)
        await clickHere(daily, gap < 300 ? 2 : 1)
        // The rows have closed up: Three's buttons are under the pointer now, hidden and deaf.
        await expect(card(daily)).toHaveAttribute('data-guard')
        await hidden(daily.button('Three', name('Three')), `Three's ${verb}`)
        expect(await left(daily), `${gone} once`).toEqual(
          verb === 'Move'
            ? { today: ['One', 'Three', 'Four', 'Five'], tomorrow: ['Two'] }
            : { today: ['One', 'Three', 'Four', 'Five'], tomorrow: [] }
        )
      })
    }
  }

  test('the pointer moved 4px, the next click works; less, it does nothing; off the card, they show again', async ({
    daily
  }) => {
    const at = await onto(daily, 'Two', 'Delete Two')
    await clickHere(daily, 1)
    await expect(daily.row('Two')).toHaveCount(0)
    await expect(card(daily)).toHaveAttribute('data-guard')
    // 2px is a hand at rest: still guarded.
    await daily.page.mouse.move(at.x + 2, at.y)
    await expect(card(daily)).toHaveAttribute('data-guard')
    await clickHere(daily, 1)
    expect((await left(daily)).today).toEqual(['One', 'Three', 'Four', 'Five'])
    // 4px from where it clicked: the buttons answer again.
    await daily.page.mouse.move(at.x + 4, at.y)
    await expect(card(daily)).not.toHaveAttribute('data-guard')
    await showing(daily.button('Three', 'Delete Three'))
    await clickHere(daily, 1)
    expect((await left(daily)).today).toEqual(['One', 'Four', 'Five'])

    // Leaving the card lifts it too.
    await expect(card(daily)).toHaveAttribute('data-guard')
    await daily.page.mouse.move(0, 0)
    await expect(card(daily)).not.toHaveAttribute('data-guard')
  })

  test('the keyboard and the right-click menu are not held back', async ({ daily }) => {
    // By keyboard nothing is guarded: Move, then the next row's bin, one after the other.
    await rest(daily)
    await edit(daily, 'One').focus()
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Move One to tomorrow')
    await daily.page.keyboard.press('Enter')
    await expect.poll(() => focused(daily)).toBe('Edit Two')
    await expect(card(daily)).not.toHaveAttribute('data-guard')
    for (let i = 0; i < 3; i++) await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Delete Two')
    await daily.page.keyboard.press('Enter')
    await expect.poll(() => focused(daily)).toBe('Edit Three')
    expect(await left(daily)).toEqual({ today: ['Three', 'Four', 'Five'], tomorrow: ['One'] })

    // Guarded by a pointer's click, a key still deletes, and the menu still opens and picks.
    await onto(daily, 'Three', 'Delete Three')
    await clickHere(daily, 1)
    await expect(card(daily)).toHaveAttribute('data-guard')
    await edit(daily, 'Four').focus()
    await daily.page.keyboard.press('Delete')
    expect((await left(daily)).today).toEqual(['Five'])
    await daily.page.mouse.move(0, 0)
    await daily.add('Six')
    await expect(daily.row('Six')).toBeVisible()
    await onto(daily, 'Five', 'Delete Five')
    await clickHere(daily, 1)
    await expect(daily.row('Five')).toHaveCount(0)
    await expect(card(daily)).toHaveAttribute('data-guard')
    // Six has slid under the still pointer: a right-click there opens its menu.
    await daily.page.mouse.down({ button: 'right' })
    await daily.page.mouse.up({ button: 'right' })
    await expect(daily.menu).toBeVisible()
    expect(await items(daily)).toContain('Delete Six')
    await daily.menuItem('Delete Six').click()
    expect((await left(daily)).today).toEqual([])
  })
})

test.describe('a button’s tip', () => {
  test.use({ seed: { [today]: seed } })

  /** The tip's box, and the button's, while it shows. */
  const placed = async (daily: Daily, button: Locator) => ({
    tip: await boxOf(daily.tip),
    button: await boxOf(button)
  })

  test('says what it does, at once on keyboard focus, 6px above it', async ({ daily }) => {
    await rest(daily)
    await edit(daily, 'Set up CI').focus()
    for (const [verb, tip] of TIPS) {
      await daily.page.keyboard.press('Tab')
      await expect.poll(() => focused(daily)).toMatch(new RegExp(`^${verb} `))
      // At once: well before a hover's wait.
      await expect(daily.tip, verb).toBeVisible({ timeout: 300 })
      await expect(daily.tip, verb).toHaveText(tip)
      const at = await placed(daily, daily.page.locator(':focus'))
      const where = `${verb}: ${JSON.stringify(at)}`
      expect(Math.abs(at.button.y - (at.tip.y + at.tip.height) - 6), where).toBeLessThanOrEqual(2)
    }
    // Leaving the row takes it away.
    await daily.input.focus()
    await expect(daily.tip).toHaveCount(0)
  })

  test('shows after a moment’s hover, not at once, and goes when the pointer leaves', async ({ daily }) => {
    await rest(daily)
    await point(daily, 'Buy milk')
    const trash = daily.button('Buy milk', 'Delete Buy milk')
    await showing(trash)
    const at = await boxOf(trash)
    await daily.page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
    await daily.page.waitForTimeout(100)
    await expect(daily.tip).toHaveCount(0)
    await expect(daily.tip).toHaveText('Delete', { timeout: 1500 })
    // The folded count's tip says it shows the steps.
    await point(daily, 'Plan the offsite')
    const fold = await boxOf(daily.chevron('Plan the offsite'))
    await daily.page.mouse.move(fold.x + fold.width / 2, fold.y + fold.height / 2)
    await expect(daily.tip).toHaveText('Show steps', { timeout: 1500 })
    await daily.page.mouse.move(0, 0)
    await expect(daily.tip).toHaveCount(0)
  })

  test('on another day Move says “Move to today”', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Next day' }).click()
    await expect(daily.heading('Tomorrow')).toBeVisible()
    await daily.add('Dentist, 9:30')
    await edit(daily, 'Dentist, 9:30').focus()
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Move Dentist, 9:30 to today')
    await expect(daily.tip).toHaveText('Move to today')
  })

  test('in the smallest window every tip stays inside the window, the last one too', async ({ daily }) => {
    await daily.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(640, 420)
    })
    await expect
      .poll(() => daily.page.evaluate(() => [window.innerWidth, window.innerHeight]))
      .toEqual([640, 420])
    for (const text of ['Buy milk', 'Set up CI', 'Fix the lint errors', 'Clean the house']) {
      await edit(daily, text).focus()
      for (const name of ending(text)) {
        if ((await daily.button(text, name).count()) === 0) continue
        await daily.page.keyboard.press('Tab')
        await expect.poll(() => focused(daily)).toBe(name)
        await expect(daily.tip, name).toBeVisible()
        await daily.page.waitForTimeout(250)
        const tip = await boxOf(daily.tip)
        const where = `${name}: ${JSON.stringify(tip)}`
        expect(tip.x, where).toBeGreaterThanOrEqual(-0.5)
        expect(tip.y, where).toBeGreaterThanOrEqual(-0.5)
        expect(tip.x + tip.width, where).toBeLessThanOrEqual(640 + 0.5)
        expect(tip.y + tip.height, where).toBeLessThanOrEqual(420 + 0.5)
      }
    }
  })
})

test.describe('on touch', () => {
  test.use({ seed: { [today]: seed } })

  test('with no hover every row shows its buttons always, and a tap shows no tip', async ({ daily }) => {
    const cdp = await daily.page.context().newCDPSession(daily.page)
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    await expect
      .poll(() => daily.page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), {
        message: 'touch emulation should turn off hover and the fine pointer'
      })
      .toBe(false)
    await daily.input.focus()
    for (const text of texts) {
      for (const name of offered(text)) await showing(daily.button(text, name), name)
    }

    // A tap on Delete deletes, and no tip shows on the way.
    const at = await boxOf(daily.button('Buy milk', 'Delete Buy milk'))
    const touch = { x: at.x + at.width / 2, y: at.y + at.height / 2 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const tips: number[] = []
    for (let i = 0; i < 16; i++) {
      tips.push(await daily.tip.count())
      await daily.page.waitForTimeout(50)
    }
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [ci, offsite, notes, house] })
    expect(tips.filter((count) => count > 0)).toEqual([])
  })
})

/** The accessible names of the open menu's items, in order, once it has them. */
async function items(daily: Daily): Promise<string[]> {
  await expect(daily.menu.getByRole('menuitem').first()).toBeVisible()
  return daily.menu
    .getByRole('menuitem')
    .evaluateAll((all) => all.map((item) => item.getAttribute('aria-label') ?? item.textContent))
}

/** Walks the open menu down to the item `name`, no further round than the menu is long. */
async function walkTo(daily: Daily, name: string): Promise<void> {
  const count = (await items(daily)).length
  for (let i = 0; i <= count && (await focused(daily)) !== name; i++) {
    await daily.page.keyboard.press('ArrowDown')
  }
  await expect.poll(() => focused(daily)).toBe(name)
}

/** Whether any item of the open menu looks picked: focused or highlighted. */
const highlighted = (daily: Daily) =>
  daily.menu
    .getByRole('menuitem')
    .evaluateAll((all) =>
      all.some((item) => item === document.activeElement || item.hasAttribute('data-highlighted'))
    )

/** Right-clicks `text`'s words, 12px in, and says where. */
async function rightClick(daily: Daily, text: string): Promise<{ x: number; y: number }> {
  const target = daily.line(text).locator('[data-todo-text]').first()
  // A card may still be coming to the front: wait for the words to hold still. Then a raw click, as
  // an open menu lies a layer over the card that the locator's own click would wait on.
  let words = await boxOf(target)
  await expect
    .poll(async () => {
      const before = words
      await daily.page.waitForTimeout(100)
      words = await boxOf(target)
      return JSON.stringify(words) === JSON.stringify(before)
    })
    .toBe(true)
  const at = { x: words.x + 12, y: words.y + words.height / 2 }
  await daily.page.mouse.click(at.x, at.y, { button: 'right' })
  // Should no menu open, say what the page was like, for a rare miss seen under load.
  const opened = await daily.menu.waitFor({ timeout: 3000 }).then(
    () => true,
    () => false
  )
  if (!opened) {
    const state = await daily.page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      const section = hit?.closest('section')
      return {
        hit: hit === null ? null : `${hit.tagName} ${hit.getAttribute('aria-label') ?? hit.className}`,
        row: hit?.closest('[data-todo]')?.querySelector('[data-todo-text]')?.textContent ?? null,
        card: section === null || section === undefined ? null : section.getAttribute('data-offset'),
        cardFlags: section === null || section === undefined ? null : Object.keys(section.dataset),
        focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? null,
        menus: [...document.querySelectorAll('[role="menu"]')].map((menu) =>
          [...menu.attributes].map((a) => a.name).join(' ')
        ),
        inert: document.querySelectorAll('[data-base-ui-inert]').length
      }
    }, at)
    throw new Error(
      `A right-click on ${text} at ${JSON.stringify(at)} opened no menu: ${JSON.stringify(state)}`
    )
  }
  return at
}

test.describe('a row’s menu, by right-click or key', () => {
  test.use({ seed: { [today]: seed } })

  test('offers what the row’s end does, and folds a row with steps', async ({ daily }) => {
    const fold = daily.menu.getByRole('menuitem', { name: /^(Hide|Show) steps/ })
    for (const text of texts) {
      await daily.openMenu(text)
      const names = await items(daily)
      const folds = names.filter((name) => /^(Hide|Show) steps/.test(name))
      expect(names.filter((name) => !folds.includes(name)).sort(), text).toEqual(offered(text).sort())
      const counted = ['Set up CI', 'Plan the offsite', 'Clean the house'].includes(text)
      expect(folds, text).toHaveLength(counted ? 1 : 0)
      // No key's hint any more.
      expect((await daily.menuItem(`Delete ${text}`).innerText()).trim(), text).toBe('Delete')
      await daily.page.keyboard.press('Escape')
      await expect(daily.menu).toHaveCount(0)
    }

    await daily.openMenu('Set up CI')
    await expect(fold).toHaveText(/Hide steps/)
    await fold.click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await expect(daily.menu).toHaveCount(0)
    await daily.openMenu('Set up CI')
    await expect(fold).toHaveText(/Show steps/)
    await fold.click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'true')
    // The fold is saved a moment later.
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: seed })
  })

  test('a right-click opens it at the pointer, focused with nothing highlighted, and swaps to another row', async ({
    daily
  }) => {
    for (const text of ['Buy milk', 'Fix the lint errors', 'Clean the house']) {
      const at = await rightClick(daily, text)
      await expect(daily.menu, text).toBeVisible()
      expect(await items(daily), text).toContain(`Delete ${text}`)
      const menu = await boxOf(daily.menu)
      const where = `${text}: pointer ${JSON.stringify(at)}, menu ${JSON.stringify(menu)}`
      // At the pointer: one of its corners within a few pixels of it.
      const near = (a: number, b: number) => Math.abs(a - b) <= 8
      expect(near(menu.x, at.x) || near(menu.x + menu.width, at.x), where).toBe(true)
      expect(near(menu.y, at.y) || near(menu.y + menu.height, at.y), where).toBe(true)
      expect(await focused(daily), where).toBe('menu')
      expect(await highlighted(daily), where).toBe(false)
      await daily.page.keyboard.press('Escape')
      await expect(daily.menu).toHaveCount(0)
      // Opened by the pointer, Escape leaves the focus on the row's text.
      await expect.poll(() => focused(daily), text).toBe(`Edit ${text}`)
    }

    // Right-clicked while another row's menu is open: that one closes, this one opens with the focus.
    await rightClick(daily, 'Buy milk')
    await expect(daily.menu).toBeVisible()
    await rightClick(daily, 'Write the release notes')
    await expect(daily.page.getByRole('menu')).toHaveCount(1)
    expect(await items(daily)).toContain('Delete Write the release notes')
    await expect.poll(() => focused(daily)).toBe('menu')
    await daily.page.keyboard.press('Escape')
    await expect(daily.menu).toHaveCount(0)
    expect(await daily.todos()).toStrictEqual({ [today]: seed })
  })

  test('a click outside an open menu only closes it: no box is checked, no steps fold', async ({ daily }) => {
    // Raw clicks at where they are: the open menu may lie a layer over the card that takes the click.
    for (const [what, target] of [
      ['a box', daily.box('Write the release notes')],
      ['a pie', daily.chevron('Set up CI')]
    ] as const) {
      const at = await boxOf(target)
      await daily.openMenu('Buy milk')
      await daily.page.mouse.click(at.x + at.width / 2, at.y + at.height / 2)
      await expect(daily.menu, what).toHaveCount(0)
      await daily.page.waitForTimeout(600)
      await expect(daily.box('Write the release notes'), what).not.toBeChecked()
      await expect(daily.chevron('Set up CI'), what).toHaveAttribute('aria-expanded', 'true')
      expect(await daily.todos(), what).toStrictEqual({ [today]: seed })
    }
  })

  test('a right press on the row that slips onto an item and is let go there picks nothing', async ({
    daily
  }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const settle = async (what: string) => {
      await daily.page.waitForTimeout(500)
      await expect(drafts, what).toHaveCount(0)
      expect(await daily.todos(), what).toStrictEqual({ [today]: seed })
      // It may stay open; closed or not, nothing was picked.
      if ((await daily.menu.count()) > 0) await daily.page.keyboard.press('Escape')
      await expect(daily.page.getByRole('menu')).toHaveCount(0)
    }
    for (const text of ['Buy milk', 'Fix the lint errors']) {
      const start = async () => {
        const at = await boxOf(daily.line(text).locator('[data-todo-text]').first())
        const x = at.x + 12
        const y = at.y + at.height / 2
        await daily.page.mouse.move(x, y)
        await daily.page.mouse.down({ button: 'right' })
        return { x, y }
      }
      for (const slip of [10, 30]) {
        const what = `right press on ${text}, ${String(slip)}px`
        const { x, y } = await start()
        await daily.page.mouse.move(x + slip, y + slip, { steps: 5 })
        await daily.page.mouse.up({ button: 'right' })
        await settle(what)
      }
      // Held all the way onto Delete, and let go there.
      const what = `right press on ${text}, onto Delete`
      await start()
      const item = daily.menuItem(`Delete ${text}`)
      await expect(item, what).toBeVisible()
      const on = await boxOf(item)
      await daily.page.mouse.move(on.x + on.width / 2, on.y + on.height / 2, { steps: 8 })
      await daily.page.mouse.up({ button: 'right' })
      await settle(what)
    }
  })

  test('Shift+F10 or the ContextMenu key on a focused row opens it at the row’s end, and Escape goes back to the text', async ({
    daily
  }) => {
    for (const key of ['Shift+F10', 'ContextMenu']) {
      for (const text of ['Buy milk', 'Fix the lint errors']) {
        const what = `${key} on ${text}`
        await edit(daily, text).focus()
        await daily.page.keyboard.press(key)
        await expect(daily.menu, what).toBeVisible()
        expect(await items(daily), what).toContain(`Delete ${text}`)
        // At the row's end: its right edge on the row's, 4px below it.
        const row = await boxOf(daily.line(text))
        const menu = await boxOf(daily.menu)
        const where = `${what}: row ${JSON.stringify(row)}, menu ${JSON.stringify(menu)}`
        expect(Math.abs(menu.x + menu.width - (row.x + row.width)), where).toBeLessThanOrEqual(1)
        expect(Math.abs(menu.y - (row.y + row.height + 4)), where).toBeLessThanOrEqual(1.5)
        await daily.page.keyboard.press('Escape')
        await expect(daily.menu).toHaveCount(0)
        await expect.poll(() => focused(daily), what).toBe(`Edit ${text}`)
      }
    }
  })

  test('by keyboard its arrows wrap, Home and End jump, Enter and Space pick, and Tab or Shift+Tab close it', async ({
    daily
  }) => {
    await edit(daily, 'Buy milk').focus()
    await daily.page.keyboard.press('Shift+F10')
    await expect(daily.menu).toBeVisible()
    const names = await items(daily)
    const first = names[0]
    const last = names.at(-1)
    await daily.page.keyboard.press('Home')
    await expect.poll(() => focused(daily)).toBe(first)
    await daily.page.keyboard.press('ArrowUp')
    await expect.poll(() => focused(daily)).toBe(last)
    await daily.page.keyboard.press('ArrowDown')
    await expect.poll(() => focused(daily)).toBe(first)
    await daily.page.keyboard.press('End')
    await expect.poll(() => focused(daily)).toBe(last)
    await daily.page.keyboard.press('Escape')
    await expect(daily.page.getByRole('menu')).toHaveCount(0)

    // Tab closes it and moves on from the row's text, to the first button after it (Move, or the fold or
    // the bin on a done todo); Shift+Tab goes back from it, to the row's box. However it was opened.
    for (const [text, how] of [
      ['Buy milk', 'Shift+F10'],
      ['Fix the lint errors', 'Shift+F10'],
      ['Clean the house', 'right-click'],
      ['Buy milk', 'right-click']
    ] as const) {
      for (const [key, to] of [
        ['Tab', daily.button(text, ending(text)[0] ?? '')],
        ['Shift+Tab', daily.box(text)]
      ] as const) {
        const what = `${key} in ${text}'s menu, opened by ${how}`
        if (how === 'right-click') await rightClick(daily, text)
        else {
          await edit(daily, text).focus()
          await daily.page.keyboard.press(how)
        }
        await expect(daily.menu, what).toBeVisible()
        await daily.page.keyboard.press('End')
        await daily.page.keyboard.press(key)
        await expect(daily.page.getByRole('menu'), what).toHaveCount(0)
        await expect(to, what).toBeFocused()
      }
    }
    expect(await daily.todos()).toStrictEqual({ [today]: seed })

    await edit(daily, 'Buy milk').focus()
    await daily.page.keyboard.press('Shift+F10')
    await expect(daily.menu).toBeVisible()
    await walkTo(daily, 'Move Buy milk to tomorrow')
    await daily.page.keyboard.press('Enter')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [ci, offsite, notes, house], [day(1)]: [milk] })
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')

    await edit(daily, 'Set up CI').focus()
    await daily.page.keyboard.press('ContextMenu')
    await expect(daily.menu).toBeVisible()
    await walkTo(daily, 'Delete Set up CI')
    await daily.page.keyboard.press('Space')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [offsite, notes, house], [day(1)]: [milk] })
    await expect.poll(() => focused(daily)).toBe('Edit Plan the offsite')
  })
})

test.describe('a row’s menu near the card’s bottom', () => {
  const many = Array.from({ length: 12 }, (_, i) => todo(`Todo ${String(i + 1).padStart(2, '0')}`))
  test.use({ seed: { [today]: many } })

  test('in the smallest window the last row’s menu flips up, inside the card', async ({ daily }) => {
    await daily.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(640, 420)
    })
    await expect
      .poll(() => daily.page.evaluate(() => [window.innerWidth, window.innerHeight]))
      .toEqual([640, 420])
    await daily.line('Todo 12').scrollIntoViewIfNeeded()
    await daily.page.waitForTimeout(300)

    for (const how of ['right-click', 'Shift+F10'] as const) {
      let at: { x: number; y: number }
      if (how === 'right-click') at = await rightClick(daily, 'Todo 12')
      else {
        await edit(daily, 'Todo 12').focus()
        await daily.page.keyboard.press('Shift+F10')
        const row = await boxOf(daily.line('Todo 12'))
        at = { x: row.x + row.width, y: row.y }
      }
      await expect(daily.menu, how).toBeVisible()
      expect(await items(daily), how).toHaveLength(3)
      const menu = await boxOf(daily.menu)
      const card = await boxOf(daily.page.locator('section[data-offset="0"]'))
      const where = `${how}: at ${JSON.stringify(at)}, menu ${JSON.stringify(menu)}, card ${JSON.stringify(card)}`
      expect(menu.y + menu.height, where).toBeLessThanOrEqual(at.y + 8)
      expect(menu.y, where).toBeGreaterThanOrEqual(card.y - 0.5)
      expect(menu.x, where).toBeGreaterThanOrEqual(card.x - 0.5)
      expect(menu.x + menu.width, where).toBeLessThanOrEqual(card.x + card.width + 0.5)
      await daily.page.keyboard.press('Escape')
      await expect(daily.menu).toHaveCount(0)
    }
  })
})

test.describe('a row’s menu when the day changes', () => {
  const book = todo('Return the library book')
  test.use({ seed: { [day(-1)]: [book], [today]: seed } })

  test('while it is open ←, → and a swipe change nothing and an arrow click only closes it; closed, they move the day', async ({
    daily
  }) => {
    const menus = daily.page.getByRole('menu')
    for (const [key, heading] of [
      ['ArrowRight', 'Tomorrow'],
      ['ArrowLeft', 'Yesterday']
    ] as const) {
      await rightClick(daily, 'Buy milk')
      await expect(daily.menu).toBeVisible()
      await daily.page.keyboard.press(key)
      await daily.page.waitForTimeout(600)
      await expect(daily.heading('Today'), key).toBeVisible()
      await expect(daily.menu, key).toBeVisible()
      // Closed, the same key changes the day, and no menu is left anywhere.
      await daily.page.keyboard.press('Escape')
      await expect(menus, key).toHaveCount(0)
      await daily.page.keyboard.press(key)
      await expect(daily.heading(heading), key).toBeVisible()
      await expect(menus, key).toHaveCount(0)
      await daily.page.getByRole('button', { name: 'Back to today' }).click()
      await expect(daily.heading('Today')).toBeVisible()
    }

    // A sideways swipe changes nothing while it is open; closed, the same swipe moves the day.
    const swipe = async () => {
      const card = await boxOf(daily.page.locator('section[data-offset="0"]'))
      await daily.page.mouse.move(card.x + 60, card.y + card.height / 2)
      for (let i = 0; i < 12; i++) {
        await daily.page.mouse.wheel(40, 0)
        await daily.page.waitForTimeout(16)
      }
      await daily.page.waitForTimeout(800)
    }
    await rightClick(daily, 'Buy milk')
    await expect(daily.menu).toBeVisible()
    await swipe()
    await expect(daily.heading('Today')).toBeVisible()
    await expect(daily.menu).toBeVisible()
    await daily.page.keyboard.press('Escape')
    await expect(menus).toHaveCount(0)
    await swipe()
    await expect(daily.heading('Today')).toBeHidden()
    await expect(menus).toHaveCount(0)
    await daily.page.getByRole('button', { name: 'Back to today' }).click()
    await expect(daily.heading('Today')).toBeVisible()

    // A click on a day's arrow only closes it.
    for (const name of ['Next day', 'Previous day']) {
      const arrow = await boxOf(daily.page.getByRole('button', { name }))
      await rightClick(daily, 'Buy milk')
      await expect(daily.menu).toBeVisible()
      await daily.page.mouse.click(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2)
      await expect(menus, name).toHaveCount(0)
      await daily.page.waitForTimeout(600)
      await expect(daily.heading('Today'), name).toBeVisible()
    }
    expect(await daily.todos()).toStrictEqual({ [day(-1)]: [book], [today]: seed })
  })
})

test.describe('a past day’s row', () => {
  const book = todo('Return the library book')
  test.use({ seed: { [day(-1)]: [book], [today]: seed } })

  test('moves to today, and at rest ends in nothing, like today’s', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Previous day' }).click()
    await expect(daily.heading('Yesterday')).toBeVisible()
    await rest(daily)
    // Once the card has come to the front and its words have faded in.
    await expect.poll(() => words(daily.line('Return the library book'))).toBe('Return the library book')
    expect(await daily.actions('Return the library book')).toEqual([
      'Move Return the library book to today',
      'Add a step to Return the library book',
      'Delete Return the library book'
    ])
    // Its bin where today's is, 4px from the row's end, once the card has settled at the front.
    await expect
      .poll(async () => {
        const row = await boxOf(daily.line('Return the library book'))
        const bin = await boxOf(daily.button('Return the library book', 'Delete Return the library book'))
        return Math.abs(row.x + row.width - 4 - (bin.x + bin.width))
      })
      .toBeLessThanOrEqual(1)
    for (const name of await daily.actions('Return the library book')) {
      await hidden(daily.button('Return the library book', name), name)
    }
    await daily.act('Return the library book', 'Move Return the library book to today')
    await expect
      .poll(async () => {
        const days = await daily.todos()
        return [(days[day(-1)] ?? []).length, (days[today] ?? []).map((entry) => entry.text)]
      })
      .toEqual([0, expect.arrayContaining(['Return the library book', ...seed.map((entry) => entry.text)])])
  })
})
