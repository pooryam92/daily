// The count's and the chevron's colours are read in the page, which needs the DOM types.
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
    // The count is read out with the toggle, not twice with the text as well. The text is described,
    // by how it is moved, but not by the count.
    const text = daily.page.getByRole('button', { name: 'Edit Set up CI', exact: true })
    await expect(text).toHaveAccessibleDescription(/^Press Enter to edit, Space to pick up\./)
    await expect(text).not.toHaveAccessibleDescription(/steps done|of 3/)
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
    // On a row, in the order they stand: the toggle, the box, the text, Move, Add a step, then the bin,
    // which ends it.
    const at = (label: string) => path.indexOf(label)
    expect(at('Steps of Plan the offsite')).toBeGreaterThanOrEqual(0)
    expect(
      [
        'Done',
        'Edit Plan the offsite',
        'Add a step to Plan the offsite',
        'Move Plan the offsite to tomorrow',
        'Delete Plan the offsite'
      ].map((label) => path.indexOf(label, at('Steps of Plan the offsite')))
    ).toEqual([1, 2, 3, 4, 5].map((after) => at('Steps of Plan the offsite') + after))
  })

  test('a click on the chevron folds the steps, and a click on the text still edits it', async ({
    daily
  }) => {
    const fold = await daily.chevron('Set up CI').boundingBox()
    if (fold === null) throw new Error('The fold of Set up CI is not shown')

    await daily.page.mouse.click(fold.x + fold.width / 2, fold.y + fold.height / 2)

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
    await daily.act('Add the workflow file', 'Delete Add the workflow file')
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

  test('adding a step through the row’s Add a step unfolds the todo', async ({ daily }) => {
    await daily.act('Plan the offsite', 'Add a step to Plan the offsite')
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
    await daily.page.getByRole('button', { name: 'Edit Plan the offsite', exact: true }).focus()
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
 * Folded, a todo shows how many of its steps are done right after its text, "1/2". A click on it
 * shows the steps; a press on it that moves lifts the row, as on the words.
 */
test.describe('the count after a folded todo’s text', () => {
  test.use({ seed: { [today]: [milk, ci, offsite] } })

  const figures = (daily: Daily) =>
    daily.line('Plan the offsite').locator('[data-todo-text] > [data-figures]')

  test('a click on it unfolds the steps, and opens no editor', async ({ daily }) => {
    await expect(figures(daily)).toHaveCount(1)
    await figures(daily).click()
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'true')
    await expect(shown(daily, 'Plan the offsite')).toHaveText(['Pick a date', 'Book the venue'])
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)
    await expect(figures(daily)).toHaveCount(0)
  })

  test('a press on it that moves lifts the row, like its words', async ({ daily }) => {
    const at = await figures(daily).boundingBox()
    if (at === null) throw new Error('The count of Plan the offsite is not shown')
    await daily.page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
    await daily.page.mouse.down()
    await daily.page.mouse.move(at.x + at.width / 2, at.y + at.height / 2 + 10, { steps: 6 })
    await expect(daily.page.locator('li[data-dragging]')).toHaveCount(1)
    await daily.page.keyboard.press('Escape')
    await daily.page.mouse.up()
    await expect(daily.page.locator('li[data-dragging]')).toHaveCount(0)
    await expect(daily.chevron('Plan the offsite')).toHaveAttribute('aria-expanded', 'false')
  })
})

/*
 * The fold (note 4): a lone chevron in the 20×28 slot at the row's start, before the box, down while
 * the steps show and turned along while they are folded. No pie: unfolded, the steps' own boxes show
 * the progress; folded, the count after the text does.
 */
test.describe('the fold', () => {
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
    const fold = daily.chevron('Set up CI')
    await fold.focus()
    await daily.page.keyboard.press('Enter')
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
    await expect(shown(daily, 'Set up CI')).toHaveCount(0)
    await expect(fold).toBeFocused()
    await daily.page.keyboard.press('Space')
    await expect(fold).toHaveAttribute('aria-expanded', 'true')
    await expect(shown(daily, 'Set up CI')).toHaveCount(3)
    await expect(fold).toHaveAccessibleDescription('0 of 3 steps done')
    await expect.poll(async () => await saved(daily, 'Set up CI')).not.toHaveProperty('folded')
  })

  for (const [width, height] of [
    [1000, 700],
    [640, 420]
  ] as const) {
    test(`every fold is in one column at the row’s start, before its box, at ${String(width)} wide`, async ({
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
          fold: await boxOf(daily.chevron(text)),
          row: await boxOf(line(daily, text)),
          box: await boxOf(daily.box(text))
        }))
      )
      const where = JSON.stringify(at)
      const first = at[0]
      if (first === undefined) throw new Error('No folds')
      for (const { fold, row, box } of at) {
        expect(Math.abs(fold.x - first.fold.x), where).toBeLessThanOrEqual(1)
        expect(Math.abs(fold.width - first.fold.width), where).toBeLessThanOrEqual(1)
        // Inside its own row, at the start, before the box.
        expect(fold.x, where).toBeGreaterThanOrEqual(row.x - 1)
        expect(fold.x + fold.width, where).toBeLessThanOrEqual(box.x + 1)
      }
    })
  }

  test('nothing moves when a row is pointed at: not the rows, the text or the folds', async ({ daily }) => {
    const measure = () =>
      Promise.all(
        [...texts, 'Buy milk'].map(async (text) => ({
          text,
          row: await boxOf(line(daily, text)),
          label: await boxOf(daily.page.getByRole('button', { name: `Edit ${text}`, exact: true })),
          fold: text === 'Buy milk' ? null : await boxOf(daily.chevron(text))
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

  test('the count after the text takes its own colour: green when every step is done and the todo is open, faint when done', async ({
    daily
  }) => {
    /** The fold, which knows how many steps are done. */
    const fold = (text: string) => daily.chevron(text)
    /**
     * The colour of the count after a folded todo's text and of its chevron, and the tokens' they may
     * take, as the page computes them.
     */
    const colours = (text: string) =>
      line(daily, text).evaluate((row) => {
        const element = row.querySelector('[data-todo-text] > [data-figures]')
        const chevron = row.querySelector('[aria-label^="Steps of "] svg')
        if (element === null || chevron === null) throw new Error('The row shows no count')
        const token = (name: string) => {
          const probe = document.createElement('span')
          probe.style.color = `var(${name})`
          element.append(probe)
          const value = getComputedStyle(probe).color
          probe.remove()
          return value
        }
        return {
          count: getComputedStyle(element).color,
          chevron: getComputedStyle(chevron).color,
          done: token('--done'),
          muted: token('--text-muted'),
          faint: token('--text-faint')
        }
      })
    const counted = async (text: string, done: number, total: number, complete: boolean) => {
      await expect(fold(text)).toHaveAttribute('data-done', String(done))
      await expect(fold(text)).toHaveAttribute('data-total', String(total))
      if (complete) await expect(fold(text)).toHaveAttribute('data-complete')
      else await expect(fold(text)).not.toHaveAttribute('data-complete')
      await expect(daily.chevron(text)).toHaveAccessibleDescription(
        `${String(done)} of ${String(total)} steps done`
      )
    }
    /** Folds `text`, then takes the pointer and the keyboard away, as a hover takes the buttons' colour. */
    const foldAway = async (text: string) => {
      if ((await fold(text).getAttribute('data-folded')) === null) await fold(text).click()
      await expect(fold(text)).toHaveAttribute('data-folded')
      await daily.page.mouse.move(0, 0)
      await daily.input.focus()
      // Past the colours' fade.
      await daily.page.waitForTimeout(300)
    }
    await counted('Set up CI', 0, 3, false)
    await counted(LONG, 1, 2, false)
    await counted('Paint the fence', 2, 2, true)
    await counted('Clean the house', 2, 2, true)
    // No pie anywhere: not on a todo, a step or a plain todo.
    await expect(daily.page.locator('[class*="_pie_"]')).toHaveCount(0)
    await expect(daily.step('Buy paint').getByRole('button', { name: /^Steps of / })).toHaveCount(0)

    // Folded, the count after the text is muted, green when all are done on an open todo, faint when
    // done; the chevron is faint at rest.
    await foldAway(LONG)
    const part = await colours(LONG)
    expect(part.count, JSON.stringify(part)).toBe(part.muted)
    expect(part.chevron, JSON.stringify(part)).toBe(part.faint)
    expect(part.done).not.toBe(part.muted)
    expect(part.faint).not.toBe(part.muted)
    for (const [text, colour] of [
      ['Paint the fence', part.done],
      ['Clean the house', part.faint]
    ] as const) {
      await foldAway(text)
      await expect.poll(async () => (await colours(text)).count, `${text} folded`).toBe(colour)
      await expect.poll(async () => (await colours(text)).chevron, `${text}’s chevron`).toBe(part.faint)
    }

    // Checking its last open step makes a todo's count green; the fold stays in its column.
    const before = await boxOf(daily.chevron('Set up CI'))
    for (const step of ['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies']) {
      await daily.box(step).check()
    }
    await counted('Set up CI', 3, 3, true)
    expect(await boxOf(daily.chevron('Set up CI'))).toEqual(before)
    await foldAway('Set up CI')
    await expect.poll(async () => (await colours('Set up CI')).count).toBe(part.done)
    expect(await boxOf(daily.chevron('Set up CI'))).toEqual(before)
  })
})
