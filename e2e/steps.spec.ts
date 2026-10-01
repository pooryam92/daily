import { day, expect, test, todo, today } from './daily'
import type { Daily } from './daily'

test('steps are added from the editor, one Enter after another', async ({ daily }) => {
  await daily.add('Set up CI')

  await daily.row('Set up CI').getByRole('button', { name: 'Edit Set up CI', exact: true }).click()
  await daily.page.getByRole('button', { name: 'Add a step to Set up CI', exact: true }).click()
  const draft = daily.page.getByRole('textbox', { name: 'New step' })
  for (const step of ['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies']) {
    await draft.fill(step)
    await draft.press('Enter')
  }
  await draft.press('Enter')

  // A locator belongs to its window, and a restart opens a new one: this finds them in either.
  const steps = () => daily.row('Set up CI').locator('li[data-step] [data-todo-text] > span:first-child')
  await expect(steps()).toHaveText(['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies'])
  await expect(draft).toBeHidden()
  await expect(daily.row('Set up CI').getByText('0/3', { exact: true })).toBeVisible()
  await expect(daily.page.getByRole('button', { name: 'Edit Set up CI', exact: true })).toBeFocused()
  const saved = {
    [today]: [
      {
        text: 'Set up CI',
        status: 'open',
        steps: [
          { text: 'Add the workflow file', status: 'open' },
          { text: 'Fix the lint errors', status: 'open' },
          { text: 'Cache the dependencies', status: 'open' }
        ]
      }
    ]
  }
  await expect.poll(() => daily.todos()).toMatchObject(saved)

  await daily.restart()

  await expect(steps()).toHaveText(['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies'])
})

test.describe('with steps', () => {
  test.use({
    seed: {
      [today]: [todo('Set up CI', 'open', [todo('Add the workflow file'), todo('Fix the lint errors')])]
    }
  })

  test('done flows down from a todo to its steps, not up', async ({ daily }) => {
    await daily.box('Add the workflow file').check()

    await expect(daily.row('Set up CI').getByText('1/2', { exact: true })).toBeVisible()
    await expect(daily.box('Set up CI')).not.toBeChecked()
    await expect
      .poll(() => daily.todos())
      .toMatchObject({ [today]: [{ status: 'open', steps: [{ status: 'done' }, { status: 'open' }] }] })

    await daily.box('Set up CI').check()

    await expect(daily.step('Add the workflow file')).toBeHidden()
    await expect(daily.step('Fix the lint errors')).toBeHidden()
    await expect(daily.row('Set up CI').getByText('2/2', { exact: true })).toBeVisible()
    await expect
      .poll(() => daily.todos())
      .toMatchObject({ [today]: [{ status: 'done', steps: [{ status: 'done' }, { status: 'done' }] }] })
  })

  test('a deleted todo comes back with its steps on Undo', async ({ daily }) => {
    const row = daily.row('Set up CI')

    await row.getByRole('button', { name: 'Delete Set up CI', exact: true }).click()

    await expect(row).toBeHidden()
    await expect.poll(() => daily.todos()).not.toHaveProperty(today)

    await daily.page.getByRole('button', { name: 'Undo' }).click()

    await expect(daily.step('Add the workflow file')).toBeVisible()
    await expect(daily.step('Fix the lint errors')).toBeVisible()
    await expect
      .poll(() => daily.todos())
      .toMatchObject({
        [today]: [
          { text: 'Set up CI', steps: [{ text: 'Add the workflow file' }, { text: 'Fix the lint errors' }] }
        ]
      })
  })
})

test.describe('with three steps', () => {
  const workflow = todo('Add the workflow file')
  const lint = todo('Fix the lint errors')
  const cache = todo('Cache the dependencies')
  const ci = todo('Set up CI', 'open', [workflow, lint, cache])
  const milk = todo('Buy milk')
  test.use({ seed: { [today]: [ci, milk] } })

  const shown = (daily: Daily) =>
    daily.row('Set up CI').locator('li[data-step] [data-todo-text] > span:first-child')
  const saved = async (daily: Daily) =>
    ((await daily.todos())[today] ?? []).map((entry) => [
      entry.text,
      ...(entry.steps ?? []).map((s) => s.text)
    ])

  test('a deleted step comes back in its place on Undo', async ({ daily }) => {
    await daily
      .step('Fix the lint errors')
      .getByRole('button', { name: 'Delete Fix the lint errors' })
      .click()

    await expect(daily.page.getByText('Step deleted')).toBeVisible()
    await expect(shown(daily)).toHaveText(['Add the workflow file', 'Cache the dependencies'])
    await expect(daily.row('Set up CI').getByText('0/2', { exact: true })).toBeVisible()
    await expect
      .poll(() => saved(daily))
      .toEqual([['Set up CI', 'Add the workflow file', 'Cache the dependencies'], ['Buy milk']])

    await daily.page.getByRole('button', { name: 'Undo' }).click()

    await expect(shown(daily)).toHaveText([
      'Add the workflow file',
      'Fix the lint errors',
      'Cache the dependencies'
    ])
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [ci, milk] })
  })

  test('a step has no move word: it goes to tomorrow with its todo', async ({ daily }) => {
    for (const step of ['Add the workflow file', 'Fix the lint errors', 'Cache the dependencies']) {
      await expect(daily.step(step).getByRole('button', { name: `Delete ${step}`, exact: true })).toHaveCount(
        1
      )
      await expect(daily.page.getByRole('button', { name: `Move ${step} to tomorrow` })).toHaveCount(0)
    }

    await daily.page.getByRole('button', { name: 'Move Set up CI to tomorrow', exact: true }).click()

    await expect(daily.row('Set up CI')).toBeHidden()
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: [milk], [day(1)]: [ci] })

    await daily.page.getByRole('button', { name: 'Next day' }).click()

    await expect(daily.heading('Tomorrow')).toBeVisible()
    await expect(shown(daily)).toHaveText([
      'Add the workflow file',
      'Fix the lint errors',
      'Cache the dependencies'
    ])
  })

  test('the ring counts todos, not steps, and only todos settle', async ({ daily }) => {
    await expect(daily.ring).toHaveAttribute('aria-valuetext', '0 of 2 resolved')

    await daily.box('Add the workflow file').check()
    await daily.box('Fix the lint errors').check()
    await daily.box('Cache the dependencies').check()
    // Longer than the settle delay: a todo checked this long ago would have gone down by now.
    await daily.page.waitForTimeout(1500)

    await expect(daily.ring).toHaveAttribute('aria-valuetext', '0 of 2 resolved')
    await expect(daily.page.getByText('Cleared')).toBeHidden()
    await expect(shown(daily)).toHaveText([
      'Add the workflow file',
      'Fix the lint errors',
      'Cache the dependencies'
    ])
    await expect(daily.row('Set up CI').getByText('3/3', { exact: true })).toBeVisible()
    await expect(daily.box('Set up CI')).not.toBeChecked()

    await daily.box('Set up CI').check()

    await expect(daily.ring).toHaveAttribute('aria-valuetext', '1 of 2 resolved')
    // A done todo settles below the open ones, as one line with its count. The span is the text
    // alone: the count is in the text button too.
    const todos = daily.page.locator(
      'li[data-todo]:not([data-step]) > div [data-todo-text] > span:first-child'
    )
    await expect(todos).toHaveText(['Buy milk', 'Set up CI'])
    await expect(daily.row('Set up CI').locator('li[data-step]')).toHaveCount(0)
    await expect(daily.row('Set up CI').getByText('3/3', { exact: true })).toBeVisible()
  })

  test('a step is reordered from the keyboard, within its todo, and Escape puts it back', async ({
    daily
  }) => {
    await daily.page.getByRole('button', { name: 'Reorder Cache the dependencies', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await daily.page.waitForTimeout(150)
    await daily.page.keyboard.press('ArrowUp')
    await daily.page.waitForTimeout(350)
    await daily.page.keyboard.press('Space')

    await expect
      .poll(() => saved(daily))
      .toEqual([
        ['Set up CI', 'Add the workflow file', 'Cache the dependencies', 'Fix the lint errors'],
        ['Buy milk']
      ])
    await expect(shown(daily)).toHaveText([
      'Add the workflow file',
      'Cache the dependencies',
      'Fix the lint errors'
    ])
    await expect(daily.heading('Today')).toBeVisible()

    // Up past the first step stays among the steps.
    await daily.page.getByRole('button', { name: 'Reorder Add the workflow file', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await daily.page.waitForTimeout(150)
    await daily.page.keyboard.press('ArrowUp')
    await daily.page.waitForTimeout(350)
    await daily.page.keyboard.press('Space')
    await daily.page.waitForTimeout(500)

    await expect
      .poll(() => saved(daily))
      .toEqual([
        ['Set up CI', 'Add the workflow file', 'Cache the dependencies', 'Fix the lint errors'],
        ['Buy milk']
      ])

    await daily.page.getByRole('button', { name: 'Reorder Fix the lint errors', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await daily.page.waitForTimeout(150)
    await daily.page.keyboard.press('ArrowUp')
    await daily.page.waitForTimeout(350)
    await daily.page.keyboard.press('Escape')
    await daily.page.waitForTimeout(500)

    await expect(shown(daily)).toHaveText([
      'Add the workflow file',
      'Cache the dependencies',
      'Fix the lint errors'
    ])
    await expect
      .poll(() => saved(daily))
      .toEqual([
        ['Set up CI', 'Add the workflow file', 'Cache the dependencies', 'Fix the lint errors'],
        ['Buy milk']
      ])
    await expect(daily.heading('Today')).toBeVisible()
  })

  test('a step being written is added when left, and nothing is when it is blank', async ({ daily }) => {
    const draft = daily.page.getByRole('textbox', { name: 'New step' })
    const openDraft = async () => {
      await daily.page.getByRole('button', { name: 'Edit Set up CI', exact: true }).click()
      await daily.page.getByRole('button', { name: 'Add a step to Set up CI', exact: true }).click()
      await expect(draft).toBeFocused()
    }
    const before = await daily.file('todos.json')

    await openDraft()
    await draft.fill('   ')
    await draft.press('Enter')
    await expect(draft).toBeHidden()

    await openDraft()
    await daily.heading('Today').click()
    await expect(draft).toBeHidden()

    await expect(shown(daily)).toHaveCount(3)
    expect(await daily.file('todos.json')).toBe(before)

    await openDraft()
    await draft.fill('Tag the release')
    await daily.heading('Today').click()

    await expect(draft).toBeHidden()
    await expect(shown(daily)).toHaveText([
      'Add the workflow file',
      'Fix the lint errors',
      'Cache the dependencies',
      'Tag the release'
    ])
    await expect
      .poll(() => saved(daily))
      .toEqual([
        [
          'Set up CI',
          'Add the workflow file',
          'Fix the lint errors',
          'Cache the dependencies',
          'Tag the release'
        ],
        ['Buy milk']
      ])
  })
})

test.describe('the file', () => {
  const step = todo('Add the workflow file')
  const ci = todo('Set up CI', 'open', [step])
  const milk = todo('Buy milk')
  test.use({ seed: { [today]: [ci, milk] } })

  test('keeps version 1, and a todo whose last step is gone has no steps key', async ({ daily }) => {
    await daily
      .step('Add the workflow file')
      .getByRole('button', { name: 'Delete Add the workflow file' })
      .click()

    await expect
      .poll(() => daily.todos())
      .toStrictEqual({ [today]: [{ id: ci.id, text: ci.text, status: 'open' }, milk] })
    const file = await daily.file('todos.json')
    expect(JSON.parse(file)).toMatchObject({ version: 1 })
    expect(file).not.toContain('"steps"')
  })
})

test.describe('a file from before steps', () => {
  const milk = todo('Buy milk')
  const mum = todo('Call mum')
  test.use({ seed: { [today]: [milk, mum] } })

  test('loads and is saved in the shape it had', async ({ daily }) => {
    await expect(daily.row('Buy milk')).toBeVisible()
    await expect(daily.row('Buy milk').getByText(/\d\/\d/)).toHaveCount(0)

    await daily.box('Buy milk').check()

    await expect
      .poll(async () => JSON.parse(await daily.file('todos.json')) as unknown)
      .toStrictEqual({ version: 1, days: { [today]: [{ ...milk, status: 'done' }, mum] } })
    expect(await daily.file('todos.json')).not.toContain('"steps"')
  })
})

test.describe('without steps', () => {
  test.use({ seed: { [today]: [todo('Set up CI')] } })

  test('Escape on a step being written adds nothing', async ({ daily }) => {
    await daily.row('Set up CI').getByRole('button', { name: 'Edit Set up CI', exact: true }).click()
    await daily.page.getByRole('button', { name: 'Add a step to Set up CI', exact: true }).click()
    const draft = daily.page.getByRole('textbox', { name: 'New step' })
    await draft.fill('Add the workflow file')
    await draft.press('Escape')

    await expect(draft).toBeHidden()
    await expect(daily.step('Add the workflow file')).toBeHidden()
    await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{ text: 'Set up CI' }] })
    expect((await daily.todos())[today]?.[0]?.steps).toBeUndefined()
  })
})
