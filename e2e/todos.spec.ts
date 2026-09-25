import { expect, test, today } from './daily'

test('a todo typed into today is on the card and on disk', async ({ daily }) => {
  await daily.add('Buy milk')

  await expect(daily.input).toHaveValue('')
  await expect(daily.row('Buy milk')).toBeVisible()
  await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{ text: 'Buy milk', status: 'open' }] })
})

test('todos are there again after a restart', async ({ daily }) => {
  await daily.add('Buy milk')
  await daily.add('Call the landlord')
  await expect.poll(async () => (await daily.todos())[today]?.length).toBe(2)

  await daily.restart()

  await expect(daily.row('Buy milk')).toBeVisible()
  await expect(daily.row('Call the landlord')).toBeVisible()
})

test('marking the last open todo done clears the day', async ({ daily }) => {
  await daily.add('Buy milk')
  const done = daily.row('Buy milk').getByRole('checkbox', { name: 'Done' })

  await done.check()

  await expect(done).toBeChecked()
  await expect(daily.page.getByText('Cleared')).toBeVisible()
  await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{ text: 'Buy milk', status: 'done' }] })

  await done.uncheck()

  await expect(daily.page.getByText('Cleared')).toBeHidden()
  await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{ status: 'open' }] })
})

test('a deleted todo comes back with Undo', async ({ daily }) => {
  await daily.add('Buy milk')
  const row = daily.row('Buy milk')

  await row.getByRole('button', { name: 'Delete Buy milk', exact: true }).click()

  await expect(row).toBeHidden()
  await expect.poll(() => daily.todos()).not.toHaveProperty(today)

  await daily.page.getByRole('button', { name: 'Undo' }).click()

  await expect(row).toBeVisible()
  await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{ text: 'Buy milk' }] })
})

test('a todo is edited where it stands', async ({ daily }) => {
  await daily.add('Buy milk')

  await daily.row('Buy milk').getByRole('button', { name: 'Edit Buy milk', exact: true }).click()
  const editor = daily.page.getByRole('textbox', { name: 'Edit todo' })
  await editor.fill('Buy oat milk')
  await editor.press('Enter')

  await expect(daily.row('Buy oat milk')).toBeVisible()
  await expect(daily.row('Buy milk')).toBeHidden()
  await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{ text: 'Buy oat milk' }] })
})
