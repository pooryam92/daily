// The opacity of a row's parts is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { boxOf, expect, seen, showing, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Locator } from '@playwright/test'
import type { Todo } from '../src/domain/todo'

/*
 * A step is added one way at a time: the 28px space under an open todo's shown steps, else Add a step at
 * the row's end, which unfolds a folded todo first. The row's end itself is row-end.spec's.
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

/** Whether `text`'s steps show, so that its add is the one under them. */
const unfolded = async (daily: Daily, text: string) =>
  (await daily.chevron(text).count()) > 0 &&
  (await daily.chevron(text).getAttribute('aria-expanded')) === 'true'

/**
 * Adds a step the one way `text` offers: the add under its steps while they show, else Add a step at
 * its row's end.
 */
async function addStep(daily: Daily, text: string): Promise<void> {
  if (await unfolded(daily, text)) {
    await daily.point(text)
    await daily.more(text).click()
  } else await daily.act(text, `Add a step to ${text}`)
}
/** The space under `text`'s steps, which holds its add. */
const spacer = (daily: Daily, text: string) => daily.row(text).locator('li[data-add-step]')
const spacers = (daily: Daily) => daily.page.locator('li[data-add-step]')
const draft = (daily: Daily) => daily.page.getByRole('textbox', { name: 'New step' })

test.describe('adding a step from the todo’s row', () => {
  test.use({ seed: { [today]: [milk, ci, offsite, fence, notes, house] } })

  test('the add under the steps opens the step draft in its place: Enter adds a step and opens the next, Escape stops', async ({
    daily
  }) => {
    const where = await boxOf(spacer(daily, 'Set up CI'))
    await daily.point('Set up CI')
    await daily.more('Set up CI').click()
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

  test('the spacer and its add are there when the steps show and the todo is open, and the row’s Add a step only when they are not', async ({
    daily
  }) => {
    await expect(spacers(daily)).toHaveCount(2)
    await expect(spacer(daily, 'Set up CI')).toHaveCount(1)
    await expect(spacer(daily, 'Paint the fence')).toHaveCount(1)
    const last = await boxOf(daily.step('Fix the lint errors'))
    const row = await boxOf(spacer(daily, 'Set up CI'))
    expect(row.y).toBeGreaterThanOrEqual(last.y + last.height - 1)
    expect(Math.abs(row.height - 28)).toBeLessThanOrEqual(1)

    expect(await daily.actions('Set up CI')).toEqual(['Move to tomorrow: Set up CI', 'Delete Set up CI'])
    await expect(daily.more('Set up CI')).toHaveCount(1)
    await expect(daily.more('Paint the fence')).toHaveCount(1)

    await daily.chevron('Set up CI').click()
    await expect(spacer(daily, 'Set up CI')).toHaveCount(0)
    await expect(daily.more('Set up CI')).toBeHidden()
    expect(await daily.actions('Set up CI')).toEqual([
      'Add a step to Set up CI',
      'Move to tomorrow: Set up CI',
      'Delete Set up CI'
    ])
    await daily.chevron('Set up CI').click()
    await expect(spacer(daily, 'Set up CI')).toHaveCount(1)
    expect(await daily.actions('Set up CI')).toEqual(['Move to tomorrow: Set up CI', 'Delete Set up CI'])

    await daily.box('Set up CI').check()
    await expect(spacer(daily, 'Set up CI')).toHaveCount(0)
    await expect(daily.more('Set up CI')).toBeHidden()
    expect(await daily.actions('Set up CI')).toEqual(['Delete Set up CI'])
    await daily.box('Set up CI').uncheck()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    expect(await daily.actions('Set up CI')).toEqual([
      'Add a step to Set up CI',
      'Move to tomorrow: Set up CI',
      'Delete Set up CI'
    ])

    for (const step of ['Buy paint', 'Sand it']) await daily.act(step, `Delete ${step}`)
    await expect(spacer(daily, 'Paint the fence')).toHaveCount(0)
    await expect(daily.more('Paint the fence')).toBeHidden()
    expect(await daily.actions('Paint the fence')).toContain('Add a step to Paint the fence')
  })

  test('the add under the steps is the whole space there: nothing at rest, its icon with its todo pointed at, its words and a step’s hover when it is pointed at or focused, and no tip', async ({
    daily
  }) => {
    await daily.page.mouse.move(0, 0)
    await daily.input.focus()
    const add = daily.more('Set up CI')
    const icon = add.locator('svg')
    const label = add.locator('span')
    /** The add's background, and the step row's hover background it takes, as the page computes them. */
    const background = () =>
      add.evaluate((button) => {
        const probe = document.createElement('span')
        probe.style.backgroundColor = 'var(--hover)'
        button.append(probe)
        const hover = getComputedStyle(probe).backgroundColor
        probe.remove()
        return { now: getComputedStyle(button).backgroundColor, hover }
      })
    const lit = async () => {
      const { hover } = await background()
      await expect.poll(async () => (await background()).now).toBe(hover)
    }
    const unlit = () =>
      expect.poll(async () => (await background()).now).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/)
    await expect.poll(() => seen(add), { message: 'at rest' }).toBeLessThan(0.05)
    await unlit()

    const at = await boxOf(add)
    const under = await boxOf(spacer(daily, 'Set up CI'))
    const step = await boxOf(daily.step('Fix the lint errors').locator(':scope > div'))
    const box = await boxOf(daily.box('Fix the lint errors'))
    const words = await boxOf(daily.step('Fix the lint errors').locator('[data-todo-text] > span').first())
    const where = `add ${JSON.stringify(at)}, space ${JSON.stringify(under)}, step ${JSON.stringify(step)}`
    expect(Math.abs(under.height - 28), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.height - 28), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.y - under.y), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.x - step.x), where).toBeLessThanOrEqual(1)
    expect(Math.abs(at.x + at.width - (step.x + step.width)), where).toBeLessThanOrEqual(1)
    await expect(icon).toHaveCount(1)
    const glyph = await boxOf(icon)
    expect(Math.round(glyph.width), where).toBeLessThanOrEqual(14)
    expect(Math.abs(glyph.x + glyph.width / 2 - (box.x + box.width / 2)), where).toBeLessThanOrEqual(2)
    await expect(label).toHaveText('Add a step')
    await expect(label).toHaveAttribute('aria-hidden', 'true')
    const text = await boxOf(label)
    expect(
      Math.abs(text.x - words.x),
      `words ${JSON.stringify(text)}, a step's ${JSON.stringify(words)}`
    ).toBeLessThanOrEqual(2)

    for (const pointed of ['Set up CI', 'Fix the lint errors', 'Add the workflow file']) {
      await daily.point(pointed)
      await showing(icon)
      expect(await seen(label), `${pointed} pointed at`).toBeLessThan(0.05)
      await unlit()
      await daily.page.mouse.move(0, 0)
      await expect.poll(() => seen(add), { message: `after ${pointed}` }).toBeLessThan(0.05)
    }
    await daily.point('Paint the fence')
    await showing(daily.more('Paint the fence').locator('svg'))
    expect(await seen(add)).toBeLessThan(0.05)

    await daily.page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
    await showing(icon)
    await showing(label)
    await lit()
    await daily.page.waitForTimeout(1200)
    await expect(daily.tip).toHaveCount(0)
    await expect(add).not.toHaveAttribute('title')

    await daily.page.mouse.move(0, 0)
    await daily.input.focus()
    await expect.poll(() => seen(add)).toBeLessThan(0.05)
    await daily.button('Fix the lint errors', 'Delete Fix the lint errors').focus()
    await daily.page.keyboard.press('Tab')
    await expect(add).toBeFocused()
    await showing(icon)
    await showing(label)
    await lit()
    await daily.page.waitForTimeout(400)
    await expect(daily.tip).toHaveCount(0)
  })

  test('the spacer is not a step: it holds only its add, and is not counted, not saved, not a place to pick up', async ({
    daily
  }) => {
    const row = spacer(daily, 'Set up CI')
    await expect(row.locator('button, a, input, [tabindex]')).toHaveCount(1)
    await expect(row.getByRole('button', { name: 'Add a step to Set up CI', exact: true })).toHaveCount(1)
    await expect(row.getByRole('checkbox')).toHaveCount(0)
    await expect(daily.chevron('Set up CI')).toHaveAccessibleDescription('1 of 2 steps done')
    await expect(daily.row('Set up CI').locator('li[data-step]')).toHaveCount(2)
    await daily.page.waitForTimeout(600)
    expect(await daily.todos()).toStrictEqual({ [today]: [milk, ci, offsite, fence, notes, house] })

    await daily.page.getByRole('button', { name: 'Edit Fix the lint errors', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await expect(
      daily.page.locator('[role="status"], [aria-live]').filter({ hasText: /^Picked up / })
    ).toHaveText('Picked up Fix the lint errors, step 2 of 2 of Set up CI.')
    await daily.page.keyboard.press('Escape')
  })
})

// What the first usability round asked for, a test each.
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

  test('the draft under steps already there says “Next step…”, and a Space typed in it lifts nothing', async ({
    daily
  }) => {
    await addStep(daily, 'Set up CI')
    await expect(draft(daily)).toBeFocused()
    await expect(draft(daily)).toHaveAttribute('placeholder', 'Next step…')
    await daily.page.keyboard.type('Tag a release')
    await daily.page.keyboard.press('Space')
    await daily.page.waitForTimeout(200)
    await expect(draft(daily)).toHaveValue('Tag a release ')
    await expect(draft(daily)).toBeFocused()
    await expect(daily.page.locator('li[data-dragging]')).toHaveCount(0)
    await expect(daily.page.locator('[data-sorting]')).toHaveCount(0)
  })

  test('while a step draft is open, the row’s buttons and the add under the steps are hidden and do nothing', async ({
    daily
  }) => {
    const drafts = daily.page.locator('li[data-draft]')
    const names = ['Move to tomorrow: Set up CI', 'Delete Set up CI']
    await daily.point('Set up CI')
    const places = []
    for (const name of names) {
      await showing(daily.button('Set up CI', name))
      places.push(await boxOf(daily.button('Set up CI', name)))
    }
    await addStep(daily, 'Set up CI')
    await expect(draft(daily)).toBeFocused()
    await daily.point('Set up CI')
    // Hidden from the pointer, the keys and the reader alike.
    await expect(
      daily.line('Set up CI').getByRole('button', { name: /^(Move|Delete|Add a step) / })
    ).toHaveCount(0)
    await expect(daily.row('Set up CI').getByRole('button', { name: 'Add a step to Set up CI' })).toHaveCount(
      0
    )
    await gone(daily.more('Set up CI'))
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
      await expect(daily.page.getByRole('textbox', { name: /^Edit (todo|step)$/ }), names[index]).toHaveCount(
        0
      )
      expect(await daily.todos(), names[index]).toStrictEqual({
        [today]: [milk, ci, offsite, fence, notes, house]
      })
    }
  })

  test('a draft closed by Escape or an empty Enter gives the focus back to the add it was opened from, or the todo’s text', async ({
    daily
  }) => {
    const label = () => daily.page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    for (const key of ['Escape', 'Enter']) {
      await daily.page.getByRole('button', { name: 'Edit Fix the lint errors', exact: true }).focus()
      await daily.page.keyboard.press('Tab')
      await daily.page.keyboard.press('Tab')
      await expect.poll(label).toBe('Add a step to Set up CI')
      await daily.page.keyboard.press('Enter')
      await expect(draft(daily)).toBeFocused()
      await daily.page.keyboard.press(key)
      await expect(daily.page.locator('li[data-draft]')).toHaveCount(0)
      await expect
        .poll(label, { message: `${key}, from the add under the steps` })
        .toBe('Add a step to Set up CI')
      await expect(daily.more('Set up CI')).toBeFocused()

      await addStep(daily, 'Write the release notes')
      await expect(draft(daily)).toBeFocused()
      await daily.page.keyboard.press(key)
      await expect(daily.page.locator('li[data-draft]')).toHaveCount(0)
      await expect
        .poll(label, { message: `${key}, from the row's Add a step` })
        .toBe('Edit Write the release notes')
    }
    expect(await daily.todos()).toStrictEqual({ [today]: [milk, ci, offsite, fence, notes, house] })
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
      await expect
        .poll(() => daily.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), {
          message: key
        })
        .toBe(key === 'Tab' ? 'Show steps of Plan the offsite' : 'Delete Fix the lint errors')
      // Left even for a control of the same todo; once it has gone, the row's buttons are back.
      await expect(drafts).toHaveCount(0)
      await expect(daily.row('Set up CI')).not.toHaveAttribute('data-drafting')
      await expect(line).not.toHaveAttribute('data-drafting')
      await daily.point('Set up CI')
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
      // Back from the box by Shift+Tab, to the row's start, so the focus is the keyboard's.
      await daily.box(text).focus()
      await daily.page.keyboard.press('Shift+Tab')
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
