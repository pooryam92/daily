import { day, expect, test, todo, today } from './daily'

test.use({ seed: { [day(-1)]: [todo('Reply to Jonas', 'done'), todo('Return the library book')] } })

test('the deck opens on today with the other days behind it', async ({ daily }) => {
  await expect(daily.heading('Today')).toBeVisible()
  await expect(daily.page.getByText('Nothing planned for today.')).toBeVisible()

  await daily.page.getByRole('button', { name: 'Previous day' }).click()

  await expect(daily.heading('Yesterday')).toBeVisible()
  await expect(daily.row('Return the library book')).toBeVisible()
  await expect(daily.row('Reply to Jonas').getByRole('checkbox', { name: 'Done' })).toBeChecked()

  await daily.page.getByRole('button', { name: 'Back to today' }).click()

  await expect(daily.heading('Today')).toBeVisible()
})

test("yesterday's leftover is moved to today", async ({ daily }) => {
  await daily.page.getByRole('button', { name: 'Previous day' }).click()
  await daily.act('Return the library book', 'Move to today: Return the library book')

  await expect(daily.page.getByText('Moved to today')).toBeVisible()
  await expect(daily.row('Return the library book')).toBeHidden()

  await daily.page.getByRole('button', { name: 'Back to today' }).click()

  await expect(daily.row('Return the library book')).toBeVisible()
  await expect
    .poll(() => daily.todos())
    .toMatchObject({
      [day(-1)]: [{ text: 'Reply to Jonas' }],
      [today]: [{ text: 'Return the library book', status: 'open' }]
    })
})

test('a todo is planned for tomorrow', async ({ daily }) => {
  await daily.page.getByRole('button', { name: 'Next day' }).click()

  await expect(daily.heading('Tomorrow')).toBeVisible()
  await expect(daily.page.getByText('Nothing planned for tomorrow.')).toBeVisible()

  await daily.add('Dentist, 9:30')

  await expect(daily.row('Dentist, 9:30')).toBeVisible()
  // Any day but today moves its todos to today.
  expect(await daily.actions('Dentist, 9:30')).toEqual([
    'Carry until done: Dentist, 9:30',
    'Add a step to Dentist, 9:30',
    'Move to today: Dentist, 9:30',
    'Delete Dentist, 9:30'
  ])
  await expect.poll(() => daily.todos()).toMatchObject({ [day(1)]: [{ text: 'Dentist, 9:30' }] })
})
