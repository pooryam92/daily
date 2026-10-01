import { expect, test, todo, today } from './daily'

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
  const steps = () => daily.row('Set up CI').locator('li[data-step] [data-todo-text]')
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
