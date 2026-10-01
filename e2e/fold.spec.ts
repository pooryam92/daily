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
    await expect(daily.row('Set up CI').getByText('0/3', { exact: true })).toBeVisible()
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

  test('a click on the count folds the steps, and a click on the text still edits it', async ({ daily }) => {
    const count = await daily.row('Set up CI').getByText('0/3', { exact: true }).boundingBox()
    if (count === null) throw new Error('The count of Set up CI is not shown')

    await daily.page.mouse.click(count.x + count.width / 2, count.y + count.height / 2)

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

  test('adding a step through `step` unfolds the todo', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Edit Plan the offsite', exact: true }).click()
    await daily.page.getByRole('button', { name: 'Add a step to Plan the offsite', exact: true }).click()
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
