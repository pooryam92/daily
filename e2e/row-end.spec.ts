// What shows on a row is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { boxOf, day, expect, hidden, showing, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Locator } from '@playwright/test'
import type { Todo } from '../src/domain/todo'

/*
 * While a todo's steps show, the space under its last step adds the next one, and its Add a step's room
 * stays empty, so Move and the bin stand in one place on every open todo.
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
const openTodos = ['Buy milk', 'Set up CI', 'Plan the offsite', 'Write the release notes']
/**
 * What each row's end offers as the seed has it, in the order its buttons stand: the bin is always
 * last. Set up CI's steps show, so its Add a step is the one under them.
 */
const offered = (text: string): string[] => {
  if (text === 'Set up CI') return [`Move ${text} to tomorrow`, `Delete ${text}`]
  return openTodos.includes(text)
    ? [`Add a step to ${text}`, `Move ${text} to tomorrow`, `Delete ${text}`]
    : [`Delete ${text}`]
}
const withSteps = ['Set up CI', 'Plan the offsite', 'Clean the house']
/** Everything on a row in the order Tab visits it, from its start: the fold, the box, the text, its end. */
const along = (text: string): string[] => [
  ...(withSteps.includes(text) ? [`Steps of ${text}`] : []),
  'Done',
  `Edit ${text}`,
  ...offered(text)
]
/** The words of each button's tip, by the start of its name, along Plan the offsite (folded). */
const TIPS = [
  ['Steps of', 'Show steps'],
  ['Add a step', 'Add a step'],
  ['Move', 'Move to tomorrow'],
  ['Delete', 'Delete']
] as const

/** The pointer off the card, and the focus in the field that adds a todo, as when nothing is done. */
async function rest(daily: Daily): Promise<void> {
  await daily.page.mouse.move(0, 0)
  await daily.input.focus()
}

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
    return (
      [element, ...element.querySelectorAll('*')]
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.width > 1 && box.height > 1 && shown(el) > 0.05
        })
        .flatMap((el) => [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE))
        // The word joiner that keeps a folded count by the last word is not a word.
        .map((node) => node.textContent?.replace(/\u2060/g, '').trim() ?? '')
        .filter((text) => text !== '')
        .join(' ')
    )
  })

/** The aria-label of whatever has the focus, so a fading copy found by role cannot answer for it. */
const focused = (daily: Daily) =>
  daily.page.evaluate(() => {
    const at = document.activeElement
    return at?.getAttribute('aria-label') ?? at?.getAttribute('role') ?? at?.tagName ?? null
  })

/**
 * What `text`'s fold shows: its icons (one chevron, nothing else), how it is turned, and how opaque
 * it looks, counting opacity on every element up from it.
 */
const foldMark = (daily: Daily, text: string) =>
  daily.chevron(text).evaluate((button) => {
    const icons = [...button.querySelectorAll('svg')].filter((el) => !el.parentElement?.closest('svg'))
    const chevron = icons[0]
    let seen = 1
    for (let up: Element | null = chevron ?? null; up !== null; up = up.parentElement) {
      const style = getComputedStyle(up)
      if (style.visibility === 'hidden' || style.display === 'none') seen = 0
      seen *= Number(style.opacity)
    }
    return {
      icons: icons.map((el) => el.getAttribute('class') ?? ''),
      rotate: chevron === undefined ? null : getComputedStyle(chevron).rotate,
      seen: chevron === undefined ? 0 : seen
    }
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

  test('an open todo has Move, Add a step unless its steps show, and Delete; a done todo and a step only Delete; no grip, no ⋯, no title', async ({
    daily
  }) => {
    for (const text of texts) expect(await daily.actions(text), text).toEqual(offered(text))
    await expect(daily.page.locator('[aria-label^="Actions for "]')).toHaveCount(0)
    // The whole row is the drag: nothing is there only to be held.
    await expect(daily.page.locator('[aria-label^="Reorder "]')).toHaveCount(0)
    await expect(daily.page.locator('[data-todo-handle]:not([aria-label^="Edit "])')).toHaveCount(0)
    // The tips are the app's own, so the window's never doubles them.
    for (const text of texts) {
      for (const name of offered(text)) {
        const button = daily.button(text, name)
        await expect(button, name).not.toHaveAttribute('title')
        const at = await boxOf(button)
        expect(Math.abs(at.width - 28), name).toBeLessThanOrEqual(1)
        expect(Math.abs(at.height - 28), name).toBeLessThanOrEqual(1)
      }
      if (withSteps.includes(text)) await expect(daily.chevron(text), text).not.toHaveAttribute('title')
    }
    await expect(daily.more('Set up CI')).not.toHaveAttribute('title')

    // By right edges from the row's end, on every open todo, Add a step shown or not.
    const fromEnd = (name: string) => (name.startsWith('Add a step') ? 76 : name.startsWith('Move') ? 48 : 4)
    for (const text of [
      'Buy milk',
      'Set up CI',
      'Plan the offsite',
      'Write the release notes',
      'Clean the house'
    ]) {
      await daily.point(text)
      const row = await boxOf(daily.line(text))
      const at = await Promise.all(
        offered(text).map(async (name) => ({ name, box: await boxOf(daily.button(text, name)) }))
      )
      const where = `${text}: ${JSON.stringify(at)}`
      for (const { name, box } of at)
        expect(Math.abs(row.x + row.width - fromEnd(name) - (box.x + box.width)), where).toBeLessThanOrEqual(
          1
        )
      const add = at.find(({ name }) => name.startsWith('Add a step'))?.box
      const move = at.find(({ name }) => name.startsWith('Move'))?.box
      if (add !== undefined && move !== undefined)
        expect(Math.abs(add.x + add.width - move.x), where).toBeLessThanOrEqual(1)
    }
    // Set up CI's Add a step keeps its room, hidden: not seen, not a stop, not read out.
    const kept = daily.line('Set up CI').locator('button[aria-label="Add a step to Set up CI"]')
    await expect(kept).toHaveCount(1)
    await expect(kept).toBeHidden()

    // The bin stands in the same place on every row, so one row's end serves for all.
    const row = await boxOf(daily.line('Buy milk'))
    for (const text of texts) {
      const bin = await boxOf(daily.button(text, `Delete ${text}`))
      expect(Math.abs(row.x + row.width - 4 - (bin.x + bin.width)), text).toBeLessThanOrEqual(1)
    }
  })

  test('at rest nothing shows at the end: a folded row starts with its chevron and has its count after the text', async ({
    daily
  }) => {
    /** Where a folded todo's count stands, and where its words end on their last line. */
    const count = (text: string) =>
      daily.line(text).evaluate((line) => {
        const figures = line.querySelector('[data-todo-text] > [data-figures]')
        // The words' own text, not the figures, should they be inside the same span.
        const text = [...(line.querySelector('[data-todo-text] > span')?.childNodes ?? [])].find(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() ?? '') !== ''
        )
        const range = document.createRange()
        if (text !== undefined) range.selectNodeContents(text)
        const words = text === undefined ? undefined : [...range.getClientRects()].at(-1)
        const box = figures?.getBoundingClientRect()
        return box === undefined || words === undefined || figures === null
          ? null
          : {
              left: box.left,
              middle: box.top + box.height / 2,
              wordsRight: words.right,
              wordsTop: words.top,
              wordsBottom: words.bottom,
              unread: figures.closest('[aria-hidden="true"]') !== null,
              struck: getComputedStyle(figures).textDecorationLine.includes('line-through')
            }
      })
    await rest(daily)
    for (const text of texts) {
      for (const name of offered(text)) await hidden(daily.button(text, name), name)
      const counted = text === 'Plan the offsite' ? `${text} 1/2` : text
      expect(await words(daily.line(text)), text).toBe(counted)
    }
    await hidden(daily.more('Set up CI'), 'the add under the steps')
    await expect(daily.chevron('Buy milk')).toHaveCount(0)
    await expect(daily.chevron('Write the release notes')).toHaveCount(0)
    // At rest the fold shows only when folded: unfolded, the steps under it say so.
    for (const text of withSteps) {
      expect(await words(daily.chevron(text)), text).toBe('')
      if ((await daily.chevron(text).getAttribute('data-folded')) === null)
        await hidden(daily.chevron(text), `${text}, unfolded`)
      else await showing(daily.chevron(text), `${text}, folded`)
    }
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('data-folded')
    await expect(daily.chevron('Set up CI')).not.toHaveAttribute('data-folded')
    // A done todo takes no steps, so there is no space under its steps, unfolded as it is.
    await expect(daily.chevron('Clean the house')).toHaveAttribute('aria-expanded', 'true')
    await expect(daily.row('Clean the house').locator('li[data-add-step]')).toHaveCount(0)
    await expect(daily.chevron('Plan the offsite')).toHaveAccessibleDescription('1 of 2 steps done')
    // On the words' last line, not at the row's end.
    const at = await count('Plan the offsite')
    if (at === null) throw new Error('Plan the offsite shows no count')
    const where = JSON.stringify(at)
    expect(Math.abs(at.left - at.wordsRight - 8), where).toBeLessThanOrEqual(2)
    expect(at.middle, where).toBeGreaterThan(at.wordsTop)
    expect(at.middle, where).toBeLessThan(at.wordsBottom)
    // Not read out, since the fold says it, and not struck; its name is still only its words.
    expect(at.unread, where).toBe(true)
    expect(at.struck, where).toBe(false)
    await expect(daily.editButton('Plan the offsite')).toHaveCount(1)

    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await daily.input.focus()
    await expect.poll(() => words(daily.line('Set up CI'))).toBe('Set up CI 1/3')
    expect(await daily.actions('Set up CI')).toEqual([
      'Add a step to Set up CI',
      'Move Set up CI to tomorrow',
      'Delete Set up CI'
    ])
    await daily.chevron('Plan the offsite').click()
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    await daily.input.focus()
    await expect.poll(() => words(daily.line('Plan the offsite'))).toBe('Plan the offsite')
    expect(await daily.actions('Plan the offsite')).toEqual([
      'Move Plan the offsite to tomorrow',
      'Delete Plan the offsite'
    ])
  })

  test('pointed at or focused from the keyboard, a row shows its buttons, and only that row', async ({
    daily
  }) => {
    await rest(daily)
    await daily.point('Set up CI')
    for (const name of offered('Set up CI')) await showing(daily.button('Set up CI', name), name)
    await hidden(daily.button('Fix the lint errors', 'Delete Fix the lint errors'))
    await hidden(daily.button('Buy milk', 'Delete Buy milk'))
    await showing(daily.more('Set up CI'), 'Set up CI pointed at')
    await daily.point('Fix the lint errors')
    await showing(daily.button('Fix the lint errors', 'Delete Fix the lint errors'))
    await hidden(daily.button('Set up CI', 'Delete Set up CI'))
    await showing(daily.more('Set up CI'), 'a step of Set up CI pointed at')
    await daily.point('Buy milk')
    await hidden(daily.more('Set up CI'), 'Buy milk pointed at')

    // A mouse click on the chevron leaves the focus in the row, but not as keyboard focus.
    await rest(daily)
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toBeFocused()
    await daily.page.mouse.move(0, 0)
    await hidden(daily.button('Set up CI', 'Delete Set up CI'))
    // Folded now, so Add a step shows too.
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Done')
    for (const name of ['Add a step to Set up CI', 'Move Set up CI to tomorrow', 'Delete Set up CI'])
      await showing(daily.button('Set up CI', name), name)
    await hidden(daily.button('Buy milk', 'Delete Buy milk'))
    await daily.editButton('Plan the offsite').focus()
    await daily.chevron('Plan the offsite').press('Enter')
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    await daily.editButton('Book the venue').focus()
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Delete Book the venue')
    await showing(daily.more('Plan the offsite'), 'its last step’s bin focused')
    await daily.editButton('Buy milk').focus()
    await daily.page.keyboard.press('Shift+Tab')
    await daily.page.keyboard.press('Tab')
    await expect(daily.editButton('Buy milk')).toBeFocused()
    for (const name of offered('Buy milk')) await showing(daily.button('Buy milk', name), name)
  })

  test('the chevron: unfolded it shows only while its row is pointed at or focused, folded it is always there, turned along; one glyph, in the room it has', async ({
    daily
  }) => {
    await rest(daily)
    const cell = await boxOf(daily.chevron('Set up CI'))
    const atRest = await foldMark(daily, 'Set up CI')
    expect(atRest.icons, JSON.stringify(atRest)).toHaveLength(1)
    expect(atRest.icons[0], JSON.stringify(atRest)).toContain('lucide-chevron-down')
    expect(atRest.rotate, JSON.stringify(atRest)).toBe('none')
    await expect.poll(async () => (await foldMark(daily, 'Set up CI')).seen, 'at rest').toBeLessThan(0.05)
    for (const how of ['pointed at', 'focused'] as const) {
      if (how === 'pointed at') await daily.point('Set up CI')
      else {
        await rest(daily)
        await daily.box('Set up CI').focus()
        await daily.page.keyboard.press('Shift+Tab')
        await expect(daily.chevron('Set up CI')).toBeFocused()
      }
      await expect.poll(async () => (await foldMark(daily, 'Set up CI')).seen, how).toBeGreaterThan(0.95)
      expect((await foldMark(daily, 'Set up CI')).rotate, how).toBe('none')
      expect(await boxOf(daily.chevron('Set up CI')), how).toEqual(cell)
    }
    await rest(daily)
    await daily.editButton('Set up CI').focus()
    await daily.page.keyboard.press('Shift+Tab')
    await daily.page.keyboard.press('Tab')
    await expect(daily.editButton('Set up CI')).toBeFocused()
    await expect
      .poll(async () => (await foldMark(daily, 'Set up CI')).seen, 'text focused')
      .toBeGreaterThan(0.95)
    await rest(daily)
    await daily.point('Fix the lint errors')
    await daily.page.waitForTimeout(300)
    expect((await foldMark(daily, 'Set up CI')).seen, 'a step pointed at').toBeLessThan(0.05)

    await rest(daily)
    const folded = await foldMark(daily, 'Plan the offsite')
    expect(folded.icons, JSON.stringify(folded)).toEqual(atRest.icons)
    await expect.poll(async () => (await foldMark(daily, 'Plan the offsite')).rotate).toBe('-90deg')
    await expect.poll(async () => (await foldMark(daily, 'Plan the offsite')).seen).toBeGreaterThan(0.95)
    const other = await boxOf(daily.chevron('Plan the offsite'))
    expect([other.x, other.width, other.height]).toEqual([cell.x, cell.width, cell.height])
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('data-folded')
    await rest(daily)
    await expect.poll(async () => (await foldMark(daily, 'Set up CI')).rotate).toBe('-90deg')
    await expect.poll(async () => (await foldMark(daily, 'Set up CI')).seen).toBeGreaterThan(0.95)
    expect(await boxOf(daily.chevron('Set up CI'))).toEqual(cell)
  })

  test('nothing moves when a row is pointed at, a button is focused, or its steps fold', async ({
    daily
  }) => {
    await rest(daily)
    const before = await measure(daily)
    for (const text of texts) {
      await daily.point(text)
      await daily.page.waitForTimeout(200)
      expect(await measure(daily), `pointing at ${text}`).toEqual(before)
    }
    await rest(daily)
    await daily.editButton('Buy milk').focus()
    for (const name of [
      ...offered('Buy milk'),
      ...along('Set up CI'),
      'Done',
      'Edit Add the workflow file'
    ]) {
      await daily.page.keyboard.press('Tab')
      await expect.poll(() => focused(daily)).toBe(name)
      await daily.page.waitForTimeout(200)
      expect(await measure(daily), `${name} focused`).toEqual(before)
    }

    // Only the count comes and goes after the words, so the text is measured without it.
    const ownLine = async (text: string) =>
      daily.line(text).evaluate((row) =>
        [row, ...row.querySelectorAll('input[type="checkbox"], [data-todo-text] > span:first-child, button')]
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

  test('every fold stands in one column at the rows’ start, before the box, the same width folded or not; every box stays in its column', async ({
    daily
  }) => {
    await rest(daily)
    const todos = ['Buy milk', 'Set up CI', 'Plan the offsite', 'Write the release notes', 'Clean the house']
    const boxes = await Promise.all(todos.map(async (text) => ({ text, box: await boxOf(daily.box(text)) })))
    const where = JSON.stringify(boxes)
    // A plain todo keeps the slot empty, so its box is where a todo with steps has it.
    for (const { box } of boxes)
      expect(Math.abs(box.x - (boxes[0]?.box.x ?? 0)), where).toBeLessThanOrEqual(1)
    const cells = []
    for (const text of withSteps) {
      const cell = await boxOf(daily.chevron(text))
      const row = await boxOf(daily.line(text))
      const box = await boxOf(daily.box(text))
      const at = `${text}: cell ${JSON.stringify(cell)}, row ${JSON.stringify(row)}, box ${JSON.stringify(box)}`
      cells.push(cell)
      // Centred on the box, not on the middle of a long text.
      expect(cell.x, at).toBeGreaterThanOrEqual(row.x - 1)
      expect(cell.x + cell.width, at).toBeLessThanOrEqual(box.x + 1)
      expect(Math.abs(cell.y + cell.height / 2 - (box.y + box.height / 2)), at).toBeLessThanOrEqual(3)
    }
    for (const cell of cells) {
      const at = JSON.stringify(cells)
      expect(Math.abs(cell.x - (cells[0]?.x ?? 0)), at).toBeLessThanOrEqual(1)
      expect(Math.abs(cell.width - (cells[0]?.width ?? 0)), at).toBeLessThanOrEqual(1)
    }
    const steps = await Promise.all(
      ['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies', 'Dust the shelves'].map(
        (text) => boxOf(daily.box(text))
      )
    )
    for (const box of steps) {
      expect(Math.abs(box.x - (steps[0]?.x ?? 0)), JSON.stringify(steps)).toBeLessThanOrEqual(1)
      expect(box.x, JSON.stringify(steps)).toBeGreaterThan((boxes[0]?.box.x ?? 0) + 8)
    }
  })

  test('by keyboard the row is the fold, the box, the text, Move, Add a step, then the bin; the add under the steps follows the last step; Enter and Space press them', async ({
    daily
  }) => {
    const path = async (from: string, count: number) => {
      await daily.editButton(from).focus()
      const on: (string | null)[] = []
      for (let i = 0; i < count; i++) {
        await daily.page.keyboard.press('Tab')
        on.push(await focused(daily))
      }
      return on
    }
    expect(await path('Buy milk', 3 + along('Set up CI').length + 1)).toEqual([
      ...offered('Buy milk'),
      ...along('Set up CI'),
      'Done'
    ])
    expect(await path('Cache the dependencies', 3)).toEqual([
      'Delete Cache the dependencies',
      'Add a step to Set up CI',
      'Steps of Plan the offsite'
    ])
    // Folded: no steps and no add under them, so on to the next todo, which has no fold to stop at.
    expect(await path('Plan the offsite', 4)).toEqual([...offered('Plan the offsite'), 'Done'])
    expect(await path('Fix the lint errors', 1)).toEqual(['Delete Fix the lint errors'])
    // A done todo has no add under its steps.
    expect(await path('Write the release notes', 3 + along('Clean the house').length)).toEqual([
      ...offered('Write the release notes'),
      ...along('Clean the house')
    ])
    expect(await path('Clean the house', 4)).toEqual([
      'Delete Clean the house',
      'Done',
      'Edit Dust the shelves',
      'Delete Dust the shelves'
    ])

    await daily.editButton('Buy milk').focus()
    await daily.page.keyboard.press('Tab')
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Move Buy milk to tomorrow')
    await daily.page.keyboard.press('Enter')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [ci, offsite, notes, house], [day(1)]: [milk] })
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')

    await daily.editButton('Write the release notes').focus()
    for (let i = 0; i < 3; i++) await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Delete Write the release notes')
    await daily.page.keyboard.press('Space')
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [ci, offsite, house], [day(1)]: [milk] })
    await expect.poll(() => focused(daily)).toBe('Edit Clean the house')
  })

  test('after Move or Delete the focus goes to the next todo, else the previous, else Add a todo', async ({
    daily
  }) => {
    await daily.act('Buy milk', 'Delete Buy milk')
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')
    await daily.page.getByRole('button', { name: 'Undo' }).dispatchEvent('click')
    await expect(daily.row('Buy milk')).toBeVisible()
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')

    await daily.act('Set up CI', 'Move Set up CI to tomorrow')
    await expect.poll(() => focused(daily)).toBe('Edit Plan the offsite')
    await daily.act('Clean the house', 'Delete Clean the house')
    await expect.poll(() => focused(daily)).toBe('Edit Write the release notes')
    await daily.act('Write the release notes', 'Delete Write the release notes')
    await expect.poll(() => focused(daily)).toBe('Edit Plan the offsite')
    await daily.act('Plan the offsite', 'Delete Plan the offsite')
    await expect.poll(() => focused(daily)).toBe('Edit Buy milk')
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
    await daily.editButton('Buy milk').focus()
    await daily.page.keyboard.press('Delete')
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [ci, offsite, notes, house] })
    await daily.editButton('Fix the lint errors').focus()
    await daily.page.keyboard.press('Backspace')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [{ ...ci, steps: [workflow, cache] }, offsite, notes, house] })
    await expect(daily.menu).toHaveCount(0)
  })

  test('while a row is carried, no row shows its buttons, not even the one carried', async ({ daily }) => {
    const text = daily.editButton('Set up CI')
    // By keyboard: the focus shows them until Space lifts the row.
    await text.focus()
    await daily.page.waitForTimeout(300)
    for (const name of offered('Set up CI'))
      await showing(daily.button('Set up CI', name), `focused: ${name}`)
    await daily.page.keyboard.press('Space')
    await expect(daily.page.locator('[data-sorting]').first()).toBeAttached()
    await expect(text).toBeFocused()
    for (const name of offered('Set up CI')) await hidden(daily.button('Set up CI', name), `carried: ${name}`)
    await hidden(daily.more('Set up CI'), 'carried: the add under the steps')
    await daily.page.keyboard.press('Escape')
    await expect(daily.page.locator('[data-sorting]')).toHaveCount(0)
    // Space lifted it, not the text's own press: nothing is being edited.
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)

    // By pointer, from its words, over another row.
    await daily.page.mouse.move(0, 0)
    const at = await boxOf(text.locator('span').first())
    await daily.page.mouse.move(at.x + 8, at.y + at.height / 2)
    await daily.page.mouse.down()
    await daily.page.mouse.move(at.x + 12, at.y + at.height / 2 + 8, { steps: 4 })
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
    await daily.point(text)
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

    await expect(card(daily)).toHaveAttribute('data-guard')
    await daily.page.mouse.move(0, 0)
    await expect(card(daily)).not.toHaveAttribute('data-guard')
  })

  test.describe('with steps', () => {
    test.use({
      seed: { [today]: [todo('Set up CI', 'open', [todo('Fix the lint errors'), todo('Cache it')])] }
    })

    test('the add under the steps is held back too: hidden, and a click there opens no draft', async ({
      daily
    }) => {
      const at = await onto(daily, 'Cache it', 'Delete Cache it')
      await clickHere(daily, 1)
      await expect(daily.step('Cache it')).toHaveCount(0)
      await expect(card(daily)).toHaveAttribute('data-guard')
      await hidden(daily.more('Set up CI'), 'guarded')
      // Where the pointer is, which the add may have slid under, a click does nothing while the guard holds.
      await daily.page.mouse.move(at.x + 2, at.y)
      await clickHere(daily, 1)
      await daily.page.waitForTimeout(400)
      await expect(daily.page.getByRole('textbox', { name: 'New step' })).toHaveCount(0)
      await daily.page.mouse.move(at.x + 4, at.y + 40)
      await expect(card(daily)).not.toHaveAttribute('data-guard')
    })
  })

  test('the keyboard and the right-click menu are not held back', async ({ daily }) => {
    await rest(daily)
    await daily.editButton('One').focus()
    await daily.page.keyboard.press('Tab')
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
    await daily.editButton('Four').focus()
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
    // Along Plan the offsite, past its box and its text, which have no tip.
    await daily.more('Set up CI').focus()
    for (const [verb, tip] of TIPS) {
      await daily.page.keyboard.press('Tab')
      while (/^(Done|Edit )/.test((await focused(daily)) ?? '')) await daily.page.keyboard.press('Tab')
      await expect.poll(() => focused(daily)).toMatch(new RegExp(`^${verb} .*Plan the offsite`))
      // At once: well before a hover's wait.
      await expect(daily.tip, verb).toBeVisible({ timeout: 300 })
      await expect(daily.tip, verb).toHaveText(tip)
      const at = await placed(daily, daily.page.locator(':focus'))
      const where = `${verb}: ${JSON.stringify(at)}`
      expect(Math.abs(at.button.y - (at.tip.y + at.tip.height) - 6), where).toBeLessThanOrEqual(2)
    }
    // The add under the steps has none: it shows its words instead.
    await daily.editButton('Cache the dependencies').focus()
    await daily.page.keyboard.press('Tab')
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Add a step to Set up CI')
    await expect.poll(() => words(daily.more('Set up CI'))).toBe('Add a step')
    await daily.page.waitForTimeout(400)
    await expect(daily.tip).toHaveCount(0)
    await daily.input.focus()
    await expect(daily.tip).toHaveCount(0)
  })

  test('shows after a moment’s hover, not at once, and goes when the pointer leaves', async ({ daily }) => {
    await rest(daily)
    await daily.point('Buy milk')
    const trash = daily.button('Buy milk', 'Delete Buy milk')
    await showing(trash)
    const at = await boxOf(trash)
    await daily.page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
    await daily.page.waitForTimeout(100)
    await expect(daily.tip).toHaveCount(0)
    await expect(daily.tip).toHaveText('Delete', { timeout: 1500 })
    await daily.point('Plan the offsite')
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
    await daily.editButton('Dentist, 9:30').focus()
    await daily.page.keyboard.press('Tab')
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
    const inside = async (name: string) => {
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
    for (const text of ['Buy milk', 'Set up CI', 'Fix the lint errors', 'Clean the house']) {
      // The fold, at the row's start, from the box after it.
      if (withSteps.includes(text)) {
        await daily.box(text).focus()
        await daily.page.keyboard.press('Shift+Tab')
        await inside(`Steps of ${text}`)
      }
      await daily.editButton(text).focus()
      for (const name of offered(text)) {
        await daily.page.keyboard.press('Tab')
        await inside(name)
      }
    }
    // The add under the steps has no tip to keep inside.
    await daily.editButton('Cache the dependencies').focus()
    await daily.page.keyboard.press('Tab')
    await daily.page.keyboard.press('Tab')
    await expect.poll(() => focused(daily)).toBe('Add a step to Set up CI')
    await daily.page.waitForTimeout(400)
    await expect(daily.tip).toHaveCount(0)
  })
})

test.describe('on touch', () => {
  test.use({ seed: { [today]: seed } })

  test('with no hover every row shows its buttons, the add under the steps and the fold’s chevron always, and a tap shows no tip', async ({
    daily
  }) => {
    const cdp = await daily.page.context().newCDPSession(daily.page)
    // With a mouse, at rest, an unfolded todo's fold shows nothing.
    await daily.page.mouse.move(0, 0)
    await daily.input.focus()
    await expect.poll(async () => (await foldMark(daily, 'Set up CI')).seen).toBeLessThan(0.05)
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
    // The add under the steps shows its icon always, and never its words.
    await showing(daily.more('Set up CI'), 'the add under the steps')
    expect(await words(daily.more('Set up CI'))).toBe('')
    // The fold shows its chevron always, unfolded or folded, faint.
    for (const text of withSteps) {
      await expect.poll(async () => (await foldMark(daily, text)).seen, text).toBeGreaterThan(0.95)
      const colour = await daily.chevron(text).evaluate((button) => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--text-faint)'
        button.append(probe)
        const faint = getComputedStyle(probe).color
        probe.remove()
        return { now: getComputedStyle(button.querySelector('svg') ?? button).color, faint }
      })
      expect(colour.now, `${text}: ${JSON.stringify(colour)}`).toBe(colour.faint)
    }

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
      // Add a step on every open todo, its steps shown or not.
      const offers = openTodos.includes(text)
        ? [`Move ${text} to tomorrow`, `Add a step to ${text}`, `Delete ${text}`]
        : [`Delete ${text}`]
      expect(names.filter((name) => !folds.includes(name)).sort(), text).toEqual(offers.sort())
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
      ['a fold', daily.chevron('Set up CI')]
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
        await daily.editButton(text).focus()
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
    await daily.editButton('Buy milk').focus()
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

    // Tab moves on from the row's text to its first button (Move, or the bin on a done todo); Shift+Tab
    // goes back to its box. However it was opened.
    for (const [text, how] of [
      ['Buy milk', 'Shift+F10'],
      ['Fix the lint errors', 'Shift+F10'],
      ['Clean the house', 'right-click'],
      ['Buy milk', 'right-click']
    ] as const) {
      for (const [key, to] of [
        ['Tab', daily.button(text, offered(text)[0] ?? '')],
        ['Shift+Tab', daily.box(text)]
      ] as const) {
        const what = `${key} in ${text}'s menu, opened by ${how}`
        if (how === 'right-click') await rightClick(daily, text)
        else {
          await daily.editButton(text).focus()
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

    await daily.editButton('Buy milk').focus()
    await daily.page.keyboard.press('Shift+F10')
    await expect(daily.menu).toBeVisible()
    await walkTo(daily, 'Move Buy milk to tomorrow')
    await daily.page.keyboard.press('Enter')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [ci, offsite, notes, house], [day(1)]: [milk] })
    await expect.poll(() => focused(daily)).toBe('Edit Set up CI')

    await daily.editButton('Set up CI').focus()
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
        await daily.editButton('Todo 12').focus()
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
      await daily.page.keyboard.press('Escape')
      await expect(menus, key).toHaveCount(0)
      await daily.page.keyboard.press(key)
      await expect(daily.heading(heading), key).toBeVisible()
      await expect(menus, key).toHaveCount(0)
      await daily.page.getByRole('button', { name: 'Back to today' }).click()
      await expect(daily.heading('Today')).toBeVisible()
    }

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
      'Add a step to Return the library book',
      'Move Return the library book to today',
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
