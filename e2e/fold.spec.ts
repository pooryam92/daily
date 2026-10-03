// The pie's colour is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { expect, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Todo } from '../src/domain/todo'

const workflow = todo('Add the workflow file')
const lint = todo('Fix the lint errors')
const cache = todo('Cache the dependencies')
const ci = todo('Set up CI', 'open', [workflow, lint, cache])
const milk = todo('Buy milk')
const offsite: Todo = {
  ...todo('Plan the offsite', 'open', [todo('Pick a date'), todo('Book the venue')]),
  folded: true
}

/** The steps shown under a todo, by their text. */
const shown = (daily: Daily, parent: string) =>
  daily.row(parent).locator('li[data-step] [data-todo-text] > span:first-child')

/** The todo with this text as it is on disk now. */
const saved = async (daily: Daily, text: string) =>
  ((await daily.todos())[today] ?? []).find((entry) => entry.text === text)

test.describe('folding steps', () => {
  test.use({ seed: { [today]: [milk, ci, offsite] } })

  test('the chevron says whether the steps show, and what it shows', async ({ daily }) => {
    const chevron = daily.chevron('Set up CI')
    // While the steps show, the chevron names the list that holds them; folded, they are not there.
    const controlled = async () => {
      const id = await chevron.getAttribute('aria-controls')
      expect(id).toBeTruthy()
      return daily.page.locator(`[id="${String(id)}"]`)
    }
    await expect(daily.chevron('Buy milk')).toHaveCount(0)
    await expect(chevron).toHaveAccessibleName('Steps of Set up CI')
    await expect(chevron).toHaveAccessibleDescription('0 of 3 steps done')
    // The count is read out with the toggle, not twice with the text as well.
    await expect(daily.page.getByRole('button', { name: 'Edit Set up CI', exact: true })).not.toHaveAttribute(
      'aria-describedby'
    )
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
    await expect(await controlled()).toHaveCount(1)
    expect(await (await controlled()).evaluate((el) => el.tagName)).toBe('UL')
    await expect(
      (await controlled()).getByRole('button', { name: 'Edit Fix the lint errors', exact: true })
    ).toHaveCount(1)

    await chevron.click()

    await expect(chevron).toHaveAttribute('aria-expanded', 'false')
    await expect(chevron).not.toHaveAttribute('aria-controls')
    await expect(daily.row('Set up CI').locator('li[data-step]')).toHaveCount(0)
    await expect(
      daily.page.getByRole('button', { name: 'Edit Fix the lint errors', exact: true })
    ).toHaveCount(0)
    await expect(daily.chevron('Set up CI')).toHaveAccessibleDescription('0 of 3 steps done')
    await expect.poll(async () => (await saved(daily, 'Set up CI'))?.folded).toBe(true)

    await chevron.click()

    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
    await expect(await controlled()).toHaveCount(1)
    await expect(shown(daily, 'Set up CI')).toHaveText([
      'Add the workflow file',
      'Fix the lint errors',
      'Cache the dependencies'
    ])
    await expect.poll(async () => await saved(daily, 'Set up CI')).not.toHaveProperty('folded')
  })

  test('the chevron is on the Tab path, and folded steps are neither focusable nor read out', async ({
    daily
  }) => {
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
    const folded = daily.row('Plan the offsite')
    expect(await folded.ariaSnapshot()).not.toMatch(/Pick a date|Book the venue/)
    await expect(daily.page.getByRole('checkbox', { name: 'Done' })).toHaveCount(6)

    await daily.page.getByRole('button', { name: 'Edit Buy milk', exact: true }).focus()
    const path: string[] = []
    for (let i = 0; i < 30; i++) {
      await daily.page.keyboard.press('Tab')
      path.push(
        await daily.page.evaluate(() => {
          const el = document.activeElement
          const step = el?.closest('li[data-step]')?.querySelector('[data-todo-text]')?.textContent ?? ''
          return `${el?.getAttribute('aria-label') ?? el?.tagName ?? ''}${step === '' ? '' : ` in ${step}`}`
        })
      )
      if (path.at(-1) === 'Add a todo') break
    }

    expect(path).toContain('Steps of Set up CI')
    expect(path).toContain('Steps of Plan the offsite')
    expect(path.filter((label) => /Pick a date|Book the venue/.test(label))).toEqual([])
    // On a row the toggle comes after the text and before the words.
    const at = (label: string) => path.indexOf(label)
    expect(at('Edit Plan the offsite')).toBeLessThan(at('Steps of Plan the offsite'))
    expect(at('Steps of Plan the offsite')).toBeLessThan(at('Move Plan the offsite to tomorrow'))
    expect(at('Move Plan the offsite to tomorrow')).toBeLessThan(at('Delete Plan the offsite'))
  })

  test('a click on the pie folds the steps, and a click on the text still edits it', async ({ daily }) => {
    const pie = await daily.chevron('Set up CI').boundingBox()
    if (pie === null) throw new Error('The pie of Set up CI is not shown')

    await daily.page.mouse.click(pie.x + pie.width / 2, pie.y + pie.height / 2)

    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await expect(shown(daily, 'Set up CI')).toHaveCount(0)
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)

    const words = await daily.row('Set up CI').locator('[data-todo-text] > span:first-child').boundingBox()
    if (words === null) throw new Error('The text of Set up CI is not shown')
    await daily.page.mouse.click(words.x + words.width / 2, words.y + words.height / 2)

    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveValue('Set up CI')
    // While the text is edited the toggle is away, with the words.
    await expect(daily.page.getByRole('button', { name: 'Steps of Set up CI', exact: true })).toHaveCount(0)
  })

  test('checking a todo folds it; unfolded, its steps are worked on, and unchecking one reopens it', async ({
    daily
  }) => {
    await daily.box('Set up CI').check()

    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await expect(shown(daily, 'Set up CI')).toHaveCount(0)
    await expect
      .poll(() => saved(daily, 'Set up CI'))
      .toMatchObject({
        status: 'done',
        folded: true,
        steps: [{ status: 'done' }, { status: 'done' }, { status: 'done' }]
      })

    await daily.chevron('Set up CI').click()

    await expect(shown(daily, 'Set up CI')).toHaveText([
      'Add the workflow file',
      'Fix the lint errors',
      'Cache the dependencies'
    ])
    await daily.page.getByRole('button', { name: 'Edit Cache the dependencies', exact: true }).click()
    const editor = daily.page.getByRole('textbox', { name: 'Edit todo' })
    await editor.fill('Cache npm')
    await editor.press('Enter')
    await daily
      .step('Add the workflow file')
      .getByRole('button', { name: 'Delete Add the workflow file' })
      .click()
    await expect(shown(daily, 'Set up CI')).toHaveText(['Fix the lint errors', 'Cache npm'])

    await daily.box('Fix the lint errors').uncheck()

    await expect(daily.box('Set up CI')).not.toBeChecked()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'true')
    await expect(shown(daily, 'Set up CI')).toHaveText(['Fix the lint errors', 'Cache npm'])
    await expect
      .poll(() => saved(daily, 'Set up CI'))
      .toStrictEqual({
        id: ci.id,
        text: 'Set up CI',
        status: 'open',
        steps: [
          { ...lint, status: 'open' },
          { ...cache, text: 'Cache npm', status: 'done' }
        ]
      })
  })

  test('adding a step through the + unfolds the todo', async ({ daily }) => {
    await daily
      .row('Plan the offsite')
      .locator(':scope > div')
      .getByRole('button', { name: 'Add a step to Plan the offsite', exact: true })
      .click()
    const draft = daily.page.getByRole('textbox', { name: 'New step' })
    await draft.fill('Send the invite')
    await draft.press('Enter')
    await draft.press('Enter')

    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    await expect(shown(daily, 'Plan the offsite')).toHaveText([
      'Pick a date',
      'Book the venue',
      'Send the invite'
    ])
    await expect.poll(() => saved(daily, 'Plan the offsite')).not.toHaveProperty('folded')
  })

  test('the fold is kept across a restart', async ({ daily }) => {
    await daily.chevron('Set up CI').click()
    await expect.poll(async () => (await saved(daily, 'Set up CI'))?.folded).toBe(true)

    await daily.restart()

    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
    await expect(shown(daily, 'Set up CI')).toHaveCount(0)
    await expect(shown(daily, 'Plan the offsite')).toHaveCount(0)
  })

  test('a folded todo that is dragged takes its steps, and stays folded', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Reorder Plan the offsite', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await daily.page.waitForTimeout(150)
    await daily.page.keyboard.press('ArrowUp')
    await daily.page.waitForTimeout(350)
    await daily.page.keyboard.press('Space')

    await expect
      .poll(async () => ((await daily.todos())[today] ?? []).map((entry) => entry.text))
      .toEqual(['Buy milk', 'Plan the offsite', 'Set up CI'])
    expect(await saved(daily, 'Plan the offsite')).toStrictEqual(offsite)
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
    await expect(shown(daily, 'Plan the offsite')).toHaveCount(0)
  })
})

/*
 * The pie (Poorya's pick, a): a small pie at the row's right edge, in one column for every todo, says
 * how many steps are done and is the fold toggle. Its name, aria-expanded and description are the
 * chevron's.
 */
test.describe('the pie', () => {
  const LONG =
    'Set up continuous integration for the desktop build and the release pipeline on every platform'
  const long = todo(LONG, 'open', [todo('Write the workflow'), todo('Sign the installers', 'done')])
  const house = todo('Clean the house', 'done', [
    todo('Dust the shelves', 'done'),
    todo('Mop the floor', 'done')
  ])
  const fence = todo('Paint the fence', 'open', [todo('Buy paint', 'done'), todo('Sand it', 'done')])
  const texts = ['Set up CI', 'Plan the offsite', LONG, 'Paint the fence', 'Clean the house']
  test.use({ seed: { [today]: [milk, ci, offsite, long, fence, house] } })

  const boxOf = async (locator: ReturnType<Daily['row']>) => {
    const box = await locator.boundingBox()
    if (box === null) throw new Error(`${locator.toString()} is not shown`)
    return box
  }
  const line = (daily: Daily, text: string) => daily.row(text).locator(':scope > div')

  test('folds and unfolds from the keyboard, with Enter or Space', async ({ daily }) => {
    const pie = daily.chevron('Set up CI')
    await pie.focus()
    await daily.page.keyboard.press('Enter')
    await expect(pie).toHaveAttribute('aria-expanded', 'false')
    await expect(shown(daily, 'Set up CI')).toHaveCount(0)
    await expect(pie).toBeFocused()
    await daily.page.keyboard.press('Space')
    await expect(pie).toHaveAttribute('aria-expanded', 'true')
    await expect(shown(daily, 'Set up CI')).toHaveCount(3)
    await expect(pie).toHaveAccessibleDescription('0 of 3 steps done')
    await expect.poll(async () => await saved(daily, 'Set up CI')).not.toHaveProperty('folded')
  })

  for (const [width, height] of [
    [1000, 700],
    [640, 420]
  ] as const) {
    test(`every pie is in one column at the row’s right edge, at ${String(width)} wide`, async ({
      daily
    }) => {
      await daily.app.evaluate(
        ({ BrowserWindow }, size) => {
          BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height)
        },
        { width, height }
      )
      await expect.poll(() => daily.page.evaluate(() => window.innerWidth)).toBe(width)
      const at = await Promise.all(
        texts.map(async (text) => ({
          text,
          pie: await boxOf(daily.chevron(text)),
          row: await boxOf(line(daily, text))
        }))
      )
      const where = JSON.stringify(at)
      const first = at[0]
      if (first === undefined) throw new Error('No pies')
      for (const { pie, row } of at) {
        expect(Math.abs(pie.x + pie.width - (first.pie.x + first.pie.width)), where).toBeLessThanOrEqual(1)
        expect(Math.abs(pie.width - first.pie.width), where).toBeLessThanOrEqual(1)
        // Inside its own row, at the end.
        expect(pie.x + pie.width, where).toBeLessThanOrEqual(row.x + row.width + 1)
        expect(pie.x, where).toBeGreaterThan(row.x + row.width / 2)
      }
    })
  }

  test('nothing moves when a row is pointed at: not the rows, the text or the pies', async ({ daily }) => {
    const measure = () =>
      Promise.all(
        [...texts, 'Buy milk'].map(async (text) => ({
          text,
          row: await boxOf(line(daily, text)),
          label: await boxOf(daily.page.getByRole('button', { name: `Edit ${text}`, exact: true })),
          pie: text === 'Buy milk' ? null : await boxOf(daily.chevron(text))
        }))
      )
    await daily.page.mouse.move(0, 0)
    await daily.input.focus()
    const before = await measure()
    for (const text of [...texts, 'Buy milk']) {
      const words = await boxOf(daily.row(text).locator('[data-todo-text] > span:first-child').first())
      await daily.page.mouse.move(words.x + 8, words.y + 10)
      await daily.page.waitForTimeout(200)
      expect(await measure(), `pointing at ${text}`).toEqual(before)
    }
  })

  test('it counts in its own colour: green when every step is done and the todo is open, faint when done', async ({
    daily
  }) => {
    const pie = (text: string) => line(daily, text).locator(':scope > [class*="_count_"]')
    /** The pie's colour, and the colours of the tokens it may take, as the page computes them. */
    const colours = (text: string) =>
      pie(text).evaluate((element) => {
        const token = (name: string) => {
          const probe = document.createElement('span')
          probe.style.color = `var(${name})`
          element.append(probe)
          const value = getComputedStyle(probe).color
          probe.remove()
          return value
        }
        return {
          pie: getComputedStyle(element).color,
          done: token('--done'),
          muted: token('--text-muted'),
          faint: token('--text-faint')
        }
      })
    const counted = async (text: string, done: number, total: number, complete: boolean) => {
      await expect(pie(text)).toHaveAttribute('data-done', String(done))
      await expect(pie(text)).toHaveAttribute('data-total', String(total))
      if (complete) await expect(pie(text)).toHaveAttribute('data-complete')
      else await expect(pie(text)).not.toHaveAttribute('data-complete')
      await expect(daily.chevron(text)).toHaveAccessibleDescription(
        `${String(done)} of ${String(total)} steps done`
      )
    }
    await counted('Set up CI', 0, 3, false)
    await counted(LONG, 1, 2, false)
    await counted('Paint the fence', 2, 2, true)
    await counted('Clean the house', 2, 2, true)
    await expect(daily.step('Buy paint').locator('[class*="_count_"]')).toHaveCount(0)
    await expect(daily.row('Buy milk').locator('[class*="_count_"]')).toHaveCount(0)

    const part = await colours(LONG)
    expect(part.pie, JSON.stringify(part)).toBe(part.muted)
    await expect.poll(async () => (await colours('Paint the fence')).pie).toBe(part.done)
    expect(part.done).not.toBe(part.muted)
    expect(part.faint).not.toBe(part.muted)
    await expect.poll(async () => (await colours('Clean the house')).pie).toBe(part.faint)

    // Checking its last open step makes a todo's pie green; it stays in the column.
    const before = await boxOf(daily.chevron('Set up CI'))
    for (const step of ['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies']) {
      await daily.box(step).check()
    }
    await counted('Set up CI', 3, 3, true)
    await expect.poll(async () => (await colours('Set up CI')).pie).toBe(part.done)
    expect(await boxOf(daily.chevron('Set up CI'))).toEqual(before)
  })
})
