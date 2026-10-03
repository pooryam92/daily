// The opacity of a row's parts is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { expect, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Locator } from '@playwright/test'
import type { Todo } from '../src/domain/todo'

/*
 * Add-step (b) (Poorya's pick): an open todo has a small + on its own row, just left of its pie, or in
 * the pie's place when it has no steps, shown while the todo is pointed at or focused (always on
 * touch). It is the only way to add a step: the editor has none. It is named "Add a step to
 * <T>", titled "Add a step", and comes between the text and the pie on the Tab path. A click opens the
 * step draft under the steps, unfolding a folded todo first; Enter chains and Escape stops. Where the
 * row that added a step was, under the steps of an unfolded open todo, an empty spacer stays: hidden
 * from the reader, not a stop, never a drop target, but its two halves still place a drop. A done
 * todo has no +.
 */
const workflow = todo('Add the workflow file', 'done')
const lint = todo('Fix the lint errors')
const ci = todo('Set up CI', 'open', [workflow, lint])
const offsite: Todo = {
  ...todo('Plan the offsite', 'open', [todo('Book the room'), todo('Send the invites')]),
  folded: true
}
const notes = todo('Write the release notes')
const house = todo('Clean the house', 'done', [
  todo('Dust the shelves', 'done'),
  todo('Mop the floor', 'done')
])
const milk = todo('Buy milk')
const fence = todo('Paint the fence', 'open', [todo('Buy paint', 'done'), todo('Sand it', 'done')])

/** The + on `text`'s own line: the one place that knows its name. */
const plus = (daily: Daily, text: string) =>
  daily
    .row(text)
    .locator(':scope > div')
    .getByRole('button', { name: `Add a step to ${text}`, exact: true })
/** Every + on the card, on any line. */
const pluses = (daily: Daily) => daily.page.getByRole('button', { name: /^Add a step to / })
/** The empty spacer under `text`'s steps, where the row that added a step was. */
const spacer = (daily: Daily, text: string) => daily.row(text).locator('li[data-add-step]')
const spacers = (daily: Daily) => daily.page.locator('li[data-add-step]')
const draft = (daily: Daily) => daily.page.getByRole('textbox', { name: 'New step' })

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${locator.toString()} is not shown`)
  return box
}

/** Points at `text`'s words, so its + shows. */
async function point(daily: Daily, text: string): Promise<void> {
  const words = await boxOf(daily.row(text).locator('[data-todo-text]').first())
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
        value *= Number(getComputedStyle(up).opacity)
      }
      return value
    }
    const leaves = [element, ...element.querySelectorAll('*')].filter((at) => at.childElementCount === 0)
    return Math.max(...leaves.map(shown))
  })
const hidden = (locator: Locator) => expect.poll(() => seen(locator)).toBeLessThan(0.05)
const showing = (locator: Locator) => expect.poll(() => seen(locator)).toBeGreaterThan(0.95)

test.describe('adding a step from the todo’s row', () => {
  test.use({ seed: { [today]: [milk, ci, offsite, fence, notes, house] } })

  test('an open todo has a + just left of its pie, or in the pie’s place without steps; a done todo or a step has none', async ({
    daily
  }) => {
    for (const text of ['Set up CI', 'Plan the offsite', 'Paint the fence']) {
      await expect(plus(daily, text)).toHaveCount(1)
      await expect(plus(daily, text)).toHaveAttribute('title', 'Add a step')
      await point(daily, text)
      const add = await boxOf(plus(daily, text))
      const pie = await boxOf(daily.chevron(text))
      const where = `${text}: + ${JSON.stringify(add)}, pie toggle ${JSON.stringify(pie)}`
      // Beside the pie's toggle, on its left, and on the same line.
      expect(add.x + add.width, where).toBeLessThanOrEqual(pie.x + 1)
      expect(pie.x - (add.x + add.width), where).toBeLessThanOrEqual(8)
      expect(Math.abs(add.y + add.height / 2 - (pie.y + pie.height / 2)), where).toBeLessThanOrEqual(1)
    }
    const toggle = await boxOf(daily.chevron('Set up CI'))
    const ciLine = await boxOf(daily.row('Set up CI').locator(':scope > div'))
    for (const text of ['Buy milk', 'Write the release notes']) {
      await expect(plus(daily, text)).toHaveCount(1)
      await expect(plus(daily, text)).toHaveAttribute('title', 'Add a step')
      await point(daily, text)
      const add = await boxOf(plus(daily, text))
      const line = await boxOf(daily.row(text).locator(':scope > div'))
      const where = `${text}: + ${JSON.stringify(add)}, its line ${JSON.stringify(line)}`
      // Where a pie's toggle is on a todo with steps: the same distance from the line's end.
      expect(
        Math.abs(
          line.x + line.width - (add.x + add.width) - (ciLine.x + ciLine.width - (toggle.x + toggle.width))
        ),
        where
      ).toBeLessThanOrEqual(1)
      expect(Math.abs(add.y - line.y - (toggle.y - ciLine.y)), where).toBeLessThanOrEqual(1)
    }
    await expect(pluses(daily)).toHaveCount(5)
    await expect(daily.row('Clean the house').getByRole('button', { name: /^Add a step to / })).toHaveCount(0)
    await expect(
      daily.step('Fix the lint errors').getByRole('button', { name: /^Add a step to / })
    ).toHaveCount(0)
  })

  test('the + shows on hover or focus only, and comes between the text and the pie on the Tab path', async ({
    daily
  }) => {
    await rest(daily)
    await hidden(plus(daily, 'Set up CI'))
    await hidden(plus(daily, 'Paint the fence'))

    await point(daily, 'Set up CI')
    await showing(plus(daily, 'Set up CI'))
    // Only the todo pointed at.
    await hidden(plus(daily, 'Paint the fence'))

    await rest(daily)
    await daily.page.getByRole('button', { name: 'Edit Set up CI', exact: true }).focus()
    await daily.page.keyboard.press('Tab')
    await expect(plus(daily, 'Set up CI')).toBeFocused()
    await showing(plus(daily, 'Set up CI'))
    await daily.page.keyboard.press('Tab')
    await expect(daily.chevron('Set up CI')).toBeFocused()
  })

  test('nothing moves when a todo is pointed at: not the rows, the text, the + or the pie', async ({
    daily
  }) => {
    const texts = ['Buy milk', 'Set up CI', 'Plan the offsite', 'Paint the fence', 'Write the release notes']
    const measure = () =>
      daily.page.evaluate(() =>
        [...document.querySelectorAll('li[data-todo] > div, li[data-add-step]')].map((row) => {
          const parts = [row, ...row.querySelectorAll(':scope > *, [data-todo-text]')]
          return parts.map((part) => {
            const { x, y, width, height } = part.getBoundingClientRect()
            return [x, y, width, height].map(Math.round).join(',')
          })
        })
      )
    await rest(daily)
    const before = await measure()
    for (const text of texts) {
      await point(daily, text)
      await daily.page.waitForTimeout(200)
      expect(await measure(), `pointing at ${text}`).toEqual(before)
    }
  })

  test('a click on the + opens the step draft under the steps: Enter adds a step and opens the next, Escape stops', async ({
    daily
  }) => {
    const where = await boxOf(spacer(daily, 'Set up CI'))
    await point(daily, 'Set up CI')
    await plus(daily, 'Set up CI').click()
    const field = draft(daily)
    await expect(field).toBeFocused()
    // It opens where the spacer was, once it has slid in: its top at the spacer's.
    const row = daily.row('Set up CI').locator('li[data-draft]')
    await expect.poll(async () => Math.abs((await boxOf(row)).y - where.y)).toBeLessThanOrEqual(1)

    await field.fill('Cache the dependencies')
    await field.press('Enter')
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await field.fill('Tag a release')
    await field.press('Enter')
    await field.press('Escape')

    await expect(field).toHaveCount(0)
    await expect(spacer(daily, 'Set up CI')).toHaveCount(1)
    await expect(daily.chevron('Set up CI')).toHaveAccessibleDescription('1 of 4 steps done')
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({
        [today]: [
          milk,
          {
            ...ci,
            steps: [
              workflow,
              lint,
              { id: expect.any(String), text: 'Cache the dependencies', status: 'open' },
              { id: expect.any(String), text: 'Tag a release', status: 'open' }
            ]
          },
          offsite,
          fence,
          notes,
          house
        ]
      })
  })

  test('on a folded todo the + unfolds it first, then opens the draft under its steps', async ({ daily }) => {
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
    await expect(spacer(daily, 'Plan the offsite')).toHaveCount(0)
    await point(daily, 'Plan the offsite')
    await plus(daily, 'Plan the offsite').click()

    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    const field = draft(daily)
    await expect(field).toBeFocused()
    const last = await boxOf(daily.step('Send the invites'))
    const at = await boxOf(field)
    expect(at.y).toBeGreaterThanOrEqual(last.y + last.height - 1)

    await field.fill('Order lunch')
    await field.press('Enter')
    await field.press('Escape')
    await expect
      .poll(async () =>
        ((await daily.todos())[today] ?? []).find((entry) => entry.text === 'Plan the offsite')
      )
      .toStrictEqual({
        id: offsite.id,
        text: 'Plan the offsite',
        status: 'open',
        steps: [...(offsite.steps ?? []), { id: expect.any(String), text: 'Order lunch', status: 'open' }]
      })
  })

  test('the spacer under the steps is there when the steps show and the todo is open, and nowhere else', async ({
    daily
  }) => {
    await expect(spacers(daily)).toHaveCount(2)
    await expect(spacer(daily, 'Set up CI')).toHaveCount(1)
    await expect(spacer(daily, 'Paint the fence')).toHaveCount(1)
    const last = await boxOf(daily.step('Fix the lint errors'))
    const row = await boxOf(spacer(daily, 'Set up CI'))
    expect(row.y).toBeGreaterThanOrEqual(last.y + last.height - 1)
    expect(Math.abs(row.height - 20)).toBeLessThanOrEqual(1)

    await daily.chevron('Set up CI').click()
    await expect(spacer(daily, 'Set up CI')).toHaveCount(0)
    await daily.chevron('Set up CI').click()
    await expect(spacer(daily, 'Set up CI')).toHaveCount(1)

    await daily.box('Set up CI').check()
    await expect(spacer(daily, 'Set up CI')).toHaveCount(0)
    await expect(plus(daily, 'Set up CI')).toHaveCount(0)
    await daily.box('Set up CI').uncheck()
    await expect(plus(daily, 'Set up CI')).toHaveCount(1)

    for (const step of ['Buy paint', 'Sand it'])
      await daily
        .step(step)
        .getByRole('button', { name: `Delete ${step}` })
        .click()
    await expect(spacer(daily, 'Paint the fence')).toHaveCount(0)
    // Without steps it is still open, so it keeps its +, in the pie's place.
    await expect(plus(daily, 'Paint the fence')).toHaveCount(1)
  })

  test('the spacer is not a step or a button: not read out, not a stop, not counted, not saved', async ({
    daily
  }) => {
    const row = spacer(daily, 'Set up CI')
    await expect(row).toHaveAttribute('aria-hidden', 'true')
    await expect(row.locator('button, a, input, [tabindex]')).toHaveCount(0)
    await expect(daily.chevron('Set up CI')).toHaveAccessibleDescription('1 of 2 steps done')
    await expect(daily.row('Set up CI').locator('li[data-step]')).toHaveCount(2)
    await daily.page.waitForTimeout(600)
    expect(await daily.todos()).toStrictEqual({ [today]: [milk, ci, offsite, fence, notes, house] })

    await daily.page.getByRole('button', { name: 'Reorder Fix the lint errors', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await expect(
      daily.page.locator('[role="status"], [aria-live]').filter({ hasText: /^Picked up / })
    ).toHaveText('Picked up Fix the lint errors, step 2 of 2 of Set up CI.')
    await daily.page.keyboard.press('Escape')
  })
})

/*
 * Usability round 1: the editor has no way to add a step; the draft says "First step…" or "Next step…";
 * while a step draft is open the row's tomorrow, delete and + are hidden and do nothing; the + shows
 * on hover or keyboard focus, not after a mouse click elsewhere on the row; the pie's title says what
 * a click does.
 */
test.describe('round 1', () => {
  test.use({ seed: { [today]: [milk, ci, offsite, fence, notes, house] } })

  /** Hidden one way or another: not rendered, invisible, or fully transparent. */
  const gone = (locator: Locator) =>
    expect
      .poll(
        async () =>
          (await locator.count()) === 0 || (await locator.isHidden()) || (await seen(locator)) < 0.05
      )
      .toBe(true)

  test('the editor has no way to add a step; a plain todo’s + opens the draft with “First step…”', async ({
    daily
  }) => {
    await daily.page.getByRole('button', { name: 'Edit Write the release notes', exact: true }).click()
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toBeFocused()
    await expect(
      daily.row('Write the release notes').getByRole('button', { name: /^Add a step to / })
    ).toHaveCount(0)
    await daily.page.keyboard.press('Escape')

    await point(daily, 'Write the release notes')
    await showing(plus(daily, 'Write the release notes'))
    await plus(daily, 'Write the release notes').click()
    await expect(draft(daily)).toBeFocused()
    await expect(draft(daily)).toHaveAttribute('placeholder', 'First step…')
    await draft(daily).fill('Collect the changes')
    await draft(daily).press('Enter')
    await expect(draft(daily)).toBeFocused()
    await expect(draft(daily)).toHaveAttribute('placeholder', 'Next step…')
    await draft(daily).press('Escape')
    await expect
      .poll(async () =>
        ((await daily.todos())[today] ?? []).find((entry) => entry.text === 'Write the release notes')
      )
      .toStrictEqual({
        ...notes,
        steps: [{ id: expect.any(String), text: 'Collect the changes', status: 'open' }]
      })
  })

  test('the draft under steps already there says “Next step…”', async ({ daily }) => {
    await point(daily, 'Set up CI')
    await plus(daily, 'Set up CI').click()
    await expect(draft(daily)).toBeFocused()
    await expect(draft(daily)).toHaveAttribute('placeholder', 'Next step…')
  })

  test('while a step draft is open, the row’s tomorrow, delete and + are hidden and do nothing', async ({
    daily
  }) => {
    const line = daily.row('Set up CI').locator(':scope > div')
    const remove = line.getByRole('button', { name: 'Delete Set up CI', exact: true })
    const later = line.getByRole('button', { name: 'Move Set up CI to tomorrow', exact: true })
    await point(daily, 'Set up CI')
    const removeAt = await boxOf(remove)
    const laterAt = await boxOf(later)
    await plus(daily, 'Set up CI').click()
    await expect(draft(daily)).toBeFocused()
    await point(daily, 'Set up CI')
    await gone(remove)
    await gone(later)
    await gone(plus(daily, 'Set up CI'))

    // A click where delete was deletes nothing, and one where tomorrow was moves nothing.
    await daily.page.mouse.click(removeAt.x + removeAt.width / 2, removeAt.y + removeAt.height / 2)
    await daily.page.waitForTimeout(600)
    await expect(daily.page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
    expect(await daily.todos()).toStrictEqual({ [today]: [milk, ci, offsite, fence, notes, house] })

    await rest(daily)
    await expect(daily.page.locator('li[data-draft]')).toHaveCount(0)
    await point(daily, 'Set up CI')
    await plus(daily, 'Set up CI').click()
    await expect(draft(daily)).toBeFocused()
    await daily.page.mouse.click(laterAt.x + laterAt.width / 2, laterAt.y + laterAt.height / 2)
    await daily.page.waitForTimeout(600)
    expect(await daily.todos()).toStrictEqual({ [today]: [milk, ci, offsite, fence, notes, house] })
  })

  test('a draft left by Tab or Shift+Tab closes: a blank one adds nothing, a typed one is saved', async ({
    daily
  }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const line = daily.row('Set up CI').locator(':scope > div')
    const remove = line.getByRole('button', { name: 'Delete Set up CI', exact: true })

    for (const key of ['Shift+Tab', 'Tab']) {
      await point(daily, 'Set up CI')
      await plus(daily, 'Set up CI').click()
      await expect(draft(daily)).toBeFocused()
      await daily.page.keyboard.press(key)
      // Left even for a control of the same todo; once it has gone, the row's words are back.
      await expect(drafts).toHaveCount(0)
      await expect(daily.row('Set up CI')).not.toHaveAttribute('data-drafting')
      await expect(line).not.toHaveAttribute('data-drafting')
      await point(daily, 'Set up CI')
      await showing(remove)
      await daily.page.waitForTimeout(300)
      expect(await daily.todos(), `blank, left by ${key}`).toStrictEqual({
        [today]: [milk, ci, offsite, fence, notes, house]
      })
    }

    const typed: string[] = []
    for (const [key, text] of [
      ['Shift+Tab', 'Cache the dependencies'],
      ['Tab', 'Run the tests on push']
    ] as const) {
      await point(daily, 'Set up CI')
      await plus(daily, 'Set up CI').click()
      await expect(draft(daily)).toBeFocused()
      await draft(daily).fill(text)
      await daily.page.keyboard.press(key)
      await expect(drafts).toHaveCount(0)
      typed.push(text)
      await expect
        .poll(async () => ((await daily.todos())[today] ?? []).find((entry) => entry.text === 'Set up CI'), {
          message: `typed, left by ${key}`
        })
        .toStrictEqual({
          ...ci,
          steps: [
            workflow,
            lint,
            ...typed.map((step) => ({ id: expect.any(String), text: step, status: 'open' }))
          ]
        })
    }
  })

  test('a + clicked right after a draft is left, inside its fade, opens a new draft that has the focus', async ({
    daily
  }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const leaves = [
      ['focus moved away', () => daily.input.focus()],
      ['Escape', () => daily.page.keyboard.press('Escape')]
    ] as const
    const typed: string[] = []
    for (const [how, leave] of leaves) {
      await point(daily, 'Set up CI')
      await plus(daily, 'Set up CI').click()
      await expect(draft(daily)).toBeFocused()
      await leave()
      // No wait: the old draft is still fading out.
      await point(daily, 'Set up CI')
      await plus(daily, 'Set up CI').click()
      // The old one is inert while it fades, but Playwright still finds it by role: ask for the focus itself.
      await expect(daily.page.locator(':focus'), `left by ${how}`).toHaveAttribute('aria-label', 'New step')
      await expect(drafts).toHaveCount(1)
      await expect(draft(daily), `left by ${how}`).toBeFocused()

      const text = `Step after ${how}`
      await daily.page.keyboard.type(text)
      await daily.page.keyboard.press('Enter')
      typed.push(text)
      await expect(draft(daily)).toBeFocused()
      await expect(draft(daily)).toHaveValue('')
      await daily.page.keyboard.press('Escape')
      await expect(drafts).toHaveCount(0)
      await expect
        .poll(async () => ((await daily.todos())[today] ?? []).find((entry) => entry.text === 'Set up CI'), {
          message: `left by ${how}`
        })
        .toStrictEqual({
          ...ci,
          steps: [
            workflow,
            lint,
            ...typed.map((step) => ({ id: expect.any(String), text: step, status: 'open' }))
          ]
        })
    }
  })

  test('the + shows on hover or keyboard focus, not after a mouse click elsewhere on the row', async ({
    daily
  }) => {
    await rest(daily)
    await point(daily, 'Set up CI')
    await showing(plus(daily, 'Set up CI'))
    // A mouse click on the pie leaves the focus in the row, but not as keyboard focus.
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toBeFocused()
    await daily.page.mouse.move(0, 0)
    await hidden(plus(daily, 'Set up CI'))
    // From the keyboard it shows.
    await daily.page.keyboard.press('Shift+Tab')
    await expect(plus(daily, 'Set up CI')).toBeFocused()
    await showing(plus(daily, 'Set up CI'))
  })

  test('the pie’s title says what a click does: “Hide steps” while they show, “Show steps” when folded', async ({
    daily
  }) => {
    await expect(daily.chevron('Set up CI')).toHaveAttribute('title', 'Hide steps')
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('title', 'Show steps')
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('title', 'Show steps')
    await daily.chevron('Set up CI').click()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('title', 'Hide steps')
  })
})
