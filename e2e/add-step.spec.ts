import { expect, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { Todo } from '../src/domain/todo'

/*
 * Add-step A (Poorya's pick): a row "+ Add a step" closes the steps of every unfolded open todo that
 * has steps. A click turns it into the step draft in place; Enter chains and Escape stops, as the
 * draft does. A todo without steps keeps `step` in its editor.
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

/** The row that adds a step to `text`: the one place that knows its name. */
const ghost = (daily: Daily, text: string) =>
  daily.row(text).getByRole('button', { name: `Add a step to ${text}`, exact: true })
const ghosts = (daily: Daily) => daily.page.locator('li[data-add-step]')

test.describe('adding a step from under the steps', () => {
  test.use({ seed: { [today]: [milk, ci, offsite, notes, house] } })

  test('closes the steps of an unfolded open todo, and of no other todo', async ({ daily }) => {
    // Always shown, not on hover.
    await daily.page.mouse.move(0, 0)
    await expect(ghost(daily, 'Set up CI')).toBeVisible()
    await expect(ghosts(daily)).toHaveCount(1)
    const last = await daily.step('Fix the lint errors').boundingBox()
    const row = await ghost(daily, 'Set up CI').boundingBox()
    if (last === null || row === null) throw new Error('The last step or the row after it is not shown')
    expect(row.y).toBeGreaterThanOrEqual(last.y + last.height - 1)

    await daily.chevron('Plan the offsite').click()
    await expect(ghost(daily, 'Plan the offsite')).toBeVisible()
    await expect(ghosts(daily)).toHaveCount(2)

    await daily.chevron('Set up CI').click()
    await expect(ghost(daily, 'Set up CI')).toHaveCount(0)
    await expect(ghosts(daily)).toHaveCount(1)
    await daily.chevron('Set up CI').click()
    await expect(ghost(daily, 'Set up CI')).toBeVisible()

    await daily.box('Set up CI').check()
    await expect(ghost(daily, 'Set up CI')).toHaveCount(0)
    // Checking a todo folds it, and reopening it leaves the fold: unfolded, it has the row again.
    await daily.box('Set up CI').uncheck()
    await expect(daily.chevron('Set up CI')).toHaveAttribute('aria-expanded', 'false')
    await expect(ghost(daily, 'Set up CI')).toHaveCount(0)
    await daily.chevron('Set up CI').click()
    await expect(ghost(daily, 'Set up CI')).toBeVisible()

    for (const step of ['Add the workflow file', 'Fix the lint errors'])
      await daily
        .step(step)
        .getByRole('button', { name: `Delete ${step}` })
        .click()
    await expect(ghost(daily, 'Set up CI')).toHaveCount(0)
    await expect(ghosts(daily)).toHaveCount(1)
  })

  test('turns into the step draft in place: Enter adds a step and opens the next, Escape stops', async ({
    daily
  }) => {
    const where = await ghost(daily, 'Set up CI').boundingBox()
    await ghost(daily, 'Set up CI').click()
    const field = daily.page.getByRole('textbox', { name: 'New step' })
    await expect(field).toBeFocused()
    await expect(ghosts(daily)).toHaveCount(0)
    const at = await field.boundingBox()
    if (where === null || at === null) throw new Error('The row or the draft is not shown')
    expect(Math.abs(at.y + at.height / 2 - (where.y + where.height / 2))).toBeLessThanOrEqual(4)

    await field.fill('Cache the dependencies')
    await field.press('Enter')
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await field.fill('Tag a release')
    await field.press('Enter')
    await field.press('Escape')

    await expect(field).toHaveCount(0)
    await expect(ghost(daily, 'Set up CI')).toBeVisible()
    await expect(daily.row('Set up CI').getByText('1/4', { exact: true })).toBeVisible()
    await expect
      .poll(() => daily.todos())
      .toMatchObject({
        [today]: [
          { text: 'Buy milk' },
          {
            text: 'Set up CI',
            steps: [
              { text: 'Add the workflow file', status: 'done' },
              { text: 'Fix the lint errors', status: 'open' },
              { text: 'Cache the dependencies', status: 'open' },
              { text: 'Tag a release', status: 'open' }
            ]
          },
          { text: 'Plan the offsite' },
          { text: 'Write the release notes' },
          { text: 'Clean the house' }
        ]
      })
  })

  test('is not a step: not counted, not saved, not a place among the steps', async ({ daily }) => {
    await expect(ghost(daily, 'Set up CI')).toBeVisible()
    await expect(daily.row('Set up CI').getByText('1/2', { exact: true })).toBeVisible()
    await expect(daily.row('Set up CI').locator('li[data-step]')).toHaveCount(2)
    await daily.page.waitForTimeout(600)
    expect(await daily.todos()).toStrictEqual({ [today]: [milk, ci, offsite, notes, house] })

    await daily.page.getByRole('button', { name: 'Reorder Fix the lint errors', exact: true }).focus()
    await daily.page.keyboard.press('Space')
    await expect(
      daily.page.locator('[role="status"], [aria-live]').filter({ hasText: /^Picked up / })
    ).toHaveText('Picked up Fix the lint errors, step 2 of 2 of Set up CI.')
    await daily.page.keyboard.press('Escape')
  })
})
