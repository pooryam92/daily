// The opacity of a row's parts is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { expect, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Locator } from '@playwright/test'
import type { Todo } from '../src/domain/todo'

/*
 * R1: an open todo's row ends in a button "Add a step to <T>", the only way to add a step: the editor
 * has none, and a done todo or a step has only Delete. It opens the step draft under the steps,
 * unfolding a folded todo first; Enter chains and Escape stops. Where the row that added a step was,
 * under the steps of an unfolded open todo, an empty spacer stays: hidden from the reader, not a stop,
 * never a drop target, but its two halves still place a drop. The row's end itself (where its buttons
 * are, when they show, their tips and keyboard) is row-end.spec's.
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

/** Clicks "Add a step" at the end of `text`'s row. */
const addStep = (daily: Daily, text: string) => daily.act(text, `Add a step to ${text}`)
/** What the end of `text`'s row offers, by name. */
const offers = (daily: Daily, text: string) => daily.actions(text)
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
const showing = (locator: Locator) => expect.poll(() => seen(locator)).toBeGreaterThan(0.95)

test.describe('adding a step from the todo’s row', () => {
  test.use({ seed: { [today]: [milk, ci, offsite, fence, notes, house] } })

  test('Add a step opens the step draft under the steps: Enter adds a step and opens the next, Escape stops', async ({
    daily
  }) => {
    const where = await boxOf(spacer(daily, 'Set up CI'))
    await addStep(daily, 'Set up CI')
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

  test('on a folded todo Add a step unfolds it first, then opens the draft under its steps', async ({
    daily
  }) => {
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
    await expect(spacer(daily, 'Plan the offsite')).toHaveCount(0)
    await addStep(daily, 'Plan the offsite')

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
    expect(await offers(daily, 'Set up CI')).toEqual(['Delete Set up CI'])
    await daily.box('Set up CI').uncheck()
    expect(await offers(daily, 'Set up CI')).toEqual([
      'Move Set up CI to tomorrow',
      'Add a step to Set up CI',
      'Delete Set up CI'
    ])

    for (const step of ['Buy paint', 'Sand it']) await daily.act(step, `Delete ${step}`)
    await expect(spacer(daily, 'Paint the fence')).toHaveCount(0)
    // Without steps it is still open, so its row still adds one.
    expect(await offers(daily, 'Paint the fence')).toContain('Add a step to Paint the fence')
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
 * Usability round 1, as R1 has it: the editor has no way to add a step; the draft says "First step…"
 * or "Next step…"; while a step draft is open the row's buttons are hidden and do nothing; a draft left
 * by Tab closes; a new draft opens focused even inside the old one's fade; the fold's tip says what a
 * click does.
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

  test('the editor has no way to add a step; a plain todo’s Add a step opens the draft with “First step…”', async ({
    daily
  }) => {
    await daily.page.getByRole('button', { name: 'Edit Write the release notes', exact: true }).click()
    const editor = daily.page.getByRole('textbox', { name: 'Edit todo' })
    await expect(editor).toBeFocused()
    // While it is edited, the row's end shows nothing: other rows' buttons are there, unseen, not its own.
    const editing = daily.page.locator('[data-todo] > div').filter({ has: editor })
    await expect(editing).toHaveCount(1)
    for (const verb of ['Move', 'Delete', 'Add a step'])
      await gone(editing.locator(`button[aria-label^="${verb} "]`))
    await expect(editing.getByRole('button', { name: /^Add a step/ })).toHaveCount(0)
    await daily.page.keyboard.press('Escape')

    await addStep(daily, 'Write the release notes')
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
    await addStep(daily, 'Set up CI')
    await expect(draft(daily)).toBeFocused()
    await expect(draft(daily)).toHaveAttribute('placeholder', 'Next step…')
  })

  test('while a step draft is open, the row’s buttons are hidden and do nothing', async ({ daily }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const names = ['Move Set up CI to tomorrow', 'Add a step to Set up CI', 'Delete Set up CI']
    await point(daily, 'Set up CI')
    const places = []
    for (const name of names) {
      await showing(daily.button('Set up CI', name))
      places.push(await boxOf(daily.button('Set up CI', name)))
    }
    await addStep(daily, 'Set up CI')
    await expect(draft(daily)).toBeFocused()
    await point(daily, 'Set up CI')
    // Hidden from the pointer, the keys and the reader alike.
    await expect(
      daily.line('Set up CI').getByRole('button', { name: /^(Move|Delete|Add a step) / })
    ).toHaveCount(0)
    for (const name of names) {
      await gone(daily.page.locator(`[data-todo] > div button[aria-label="${name}"]`))
      expect(
        await daily.page
          .locator(`[data-todo] > div button[aria-label="${name}"]`)
          .evaluate((button) => button.closest('[inert]') !== null || (button as HTMLButtonElement).inert),
        `${name} is inert`
      ).toBe(true)
    }

    // Nor can the row's menu be opened by key from the draft.
    await daily.page.keyboard.press('Shift+F10')
    await daily.page.waitForTimeout(300)
    await expect(daily.menu).toHaveCount(0)
    await expect(draft(daily)).toBeFocused()

    // A click where each button was does nothing. Should it take the focus from the blank draft, that
    // closes, and it is opened again for the next.
    for (const [index, at] of places.entries()) {
      if ((await drafts.count()) === 0 || index === 0) {
        await expect(drafts).toHaveCount(index === 0 ? 1 : 0)
        if (index > 0) await addStep(daily, 'Set up CI')
        await expect(draft(daily)).toBeFocused()
      }
      await daily.page.mouse.click(at.x + at.width / 2, at.y + at.height / 2)
      await daily.page.waitForTimeout(600)
      await expect(daily.menu).toHaveCount(0)
      await expect(daily.page.getByRole('textbox', { name: 'Edit todo' }), names[index]).toHaveCount(0)
      expect(await daily.todos(), names[index]).toStrictEqual({
        [today]: [milk, ci, offsite, fence, notes, house]
      })
    }
  })

  test('a draft left by Tab or Shift+Tab closes: a blank one adds nothing, a typed one is saved', async ({
    daily
  }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const line = daily.row('Set up CI').locator(':scope > div')

    for (const key of ['Shift+Tab', 'Tab']) {
      await addStep(daily, 'Set up CI')
      await expect(draft(daily)).toBeFocused()
      await daily.page.keyboard.press(key)
      // Left even for a control of the same todo; once it has gone, the row's buttons are back.
      await expect(drafts).toHaveCount(0)
      await expect(daily.row('Set up CI')).not.toHaveAttribute('data-drafting')
      await expect(line).not.toHaveAttribute('data-drafting')
      await point(daily, 'Set up CI')
      await showing(daily.button('Set up CI', 'Delete Set up CI'))
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
      await addStep(daily, 'Set up CI')
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

  test('Add a step picked right after a draft is left, inside its fade, opens a new draft that has the focus', async ({
    daily
  }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const leaves = [
      ['focus moved away', () => daily.input.focus()],
      ['Escape', () => daily.page.keyboard.press('Escape')]
    ] as const
    const typed: string[] = []
    for (const [how, leave] of leaves) {
      await addStep(daily, 'Set up CI')
      await expect(draft(daily)).toBeFocused()
      await leave()
      // No wait: the old draft is still fading out.
      await addStep(daily, 'Set up CI')
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

  test('the fold’s tip says what a click does: “Hide steps” while they show, “Show steps” when folded', async ({
    daily
  }) => {
    // Its own tip, not the window's: no title on it.
    await expect(daily.chevron('Set up CI')).not.toHaveAttribute('title')
    await expect(daily.chevron('Plan the offsite')).not.toHaveAttribute('title')
    for (const [text, tip] of [
      ['Set up CI', 'Hide steps'],
      ['Plan the offsite', 'Show steps']
    ] as const) {
      // From the text by Tab, past Move and Add a step, so the focus is the keyboard's.
      await daily.page.getByRole('button', { name: `Edit ${text}`, exact: true }).focus()
      for (let i = 0; i < 3; i++) await daily.page.keyboard.press('Tab')
      await expect(daily.chevron(text)).toBeFocused()
      await expect(daily.tip, text).toHaveText(tip)
    }
    // A press folds or unfolds them; the tip then says the other, the next time it shows.
    const again = async (text: string) => {
      await daily.page.keyboard.press('Shift+Tab')
      await daily.page.keyboard.press('Tab')
      await expect(daily.chevron(text)).toBeFocused()
    }
    await daily.chevron('Plan the offsite').press('Enter')
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    await again('Plan the offsite')
    await expect(daily.tip).toHaveText('Hide steps')
    await daily.chevron('Plan the offsite').press('Enter')
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
    await again('Plan the offsite')
    await expect(daily.tip).toHaveText('Show steps')
  })
})
