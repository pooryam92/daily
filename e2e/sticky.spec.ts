import { boxOf, day, expect, sinceText, stuck, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { DayKey, Todo } from '../src/domain/todo'

const onDisk = async (daily: Daily, key: DayKey) => (await daily.todos())[key] ?? []

async function back(daily: Daily, days: number): Promise<void> {
  for (let i = 0; i < days; i++) await daily.page.getByRole('button', { name: 'Previous day' }).click()
}

async function tabToPin(daily: Daily, text: string): Promise<void> {
  await daily.editButton(text).focus()
  await daily.page.keyboard.press('Tab')
  await expect(daily.stick(text)).toBeFocused()
}

async function stick(daily: Daily, text: string): Promise<void> {
  await daily.line(text).hover()
  await daily.stick(text).click()
  await expect(daily.page.locator('[data-leaving]')).toHaveCount(0)
}

test.describe('a sticky left on an old day', () => {
  const report = stuck('Write the report', day(-4))
  test.use({ seed: { [day(-4)]: [todo('Call the bank'), report], [today]: [todo('Buy milk')] } })

  test('is on today after launch, and its old day no longer has it', async ({ daily }) => {
    await expect(daily.heading('Today')).toBeVisible()
    await expect(daily.carried).toHaveText(['Write the report'])
    await expect(daily.page.getByRole('list', { name: 'Carried' })).toBeVisible()
    await expect(daily.line('Write the report')).toHaveAttribute('data-age', '4')
    await expect(daily.own).toHaveText(['Buy milk'])
    await expect
      .poll(() => daily.todos())
      .toStrictEqual({
        [day(-4)]: [expect.objectContaining({ text: 'Call the bank' })],
        [today]: [expect.objectContaining({ text: 'Buy milk' }), { ...report, sticky: { since: day(-4) } }]
      })

    await back(daily, 4)

    await expect(daily.row('Call the bank')).toBeVisible()
    await expect(daily.row('Write the report')).toBeHidden()
  })

  test('says since when on hover, and on keyboard focus', async ({ daily }) => {
    await daily.age('Write the report').hover()
    await expect(daily.tip).toHaveText(sinceText(day(-4), 4))

    await daily.page.mouse.move(0, 0)
    await expect(daily.tip).toBeHidden()
    await tabToPin(daily, 'Write the report')
    await expect(daily.tip).toHaveText(sinceText(day(-4), 4))
  })

  test('is still on today after a restart', async ({ daily }) => {
    await expect.poll(() => onDisk(daily, today)).toHaveLength(2)

    await daily.restart()

    await expect(daily.carried).toHaveText(['Write the report'])
    await expect.poll(() => daily.todos()).toMatchObject({ [today]: [{}, { sticky: { since: day(-4) } }] })
  })

  test('unsticks to a normal todo on today, after the others', async ({ daily }) => {
    await stick(daily, 'Write the report')

    await expect(daily.carried).toHaveCount(0)
    await expect(
      daily.page.locator('section[data-offset="0"]').getByText('Carried', { exact: true })
    ).toBeHidden()
    await expect(daily.own).toHaveText(['Buy milk', 'Write the report'])
    await expect
      .poll(() => onDisk(daily, today))
      .toStrictEqual([
        expect.objectContaining({ text: 'Buy milk' }),
        { id: report.id, text: 'Write the report', status: 'open' }
      ])
  })

  test('comes back to today on Undo after a delete', async ({ daily }) => {
    await daily.act('Write the report', 'Delete Write the report')

    await expect(daily.row('Write the report')).toBeHidden()
    await expect.poll(() => onDisk(daily, today)).toHaveLength(1)

    await daily.page.getByRole('button', { name: 'Undo' }).click()

    await expect(daily.carried).toHaveText(['Write the report'])
    await expect
      .poll(() => daily.todos())
      .toMatchObject({
        [today]: [{ text: 'Buy milk' }, { text: 'Write the report', sticky: { since: day(-4) } }]
      })
    await expect.poll(async () => (await onDisk(daily, day(-4))).length).toBe(1)
  })
})

test.describe('the ring', () => {
  test.use({ seed: { [today]: [todo('Buy milk', 'done'), stuck('Write the report', day(-2))] } })

  test('reads Cleared with an open sticky, and counts it once ticked', async ({ daily }) => {
    await expect(daily.ring).toHaveAttribute('aria-valuetext', '1 of 1 resolved')
    await expect(daily.page.getByText('Cleared')).toBeVisible()

    await daily.box('Write the report').check()

    await expect(daily.ring).toHaveAttribute('aria-valuetext', '2 of 2 resolved')
    await expect(daily.carried).toHaveText(['Write the report'])
    await expect(daily.age('Write the report')).toHaveCount(0)
    await expect
      .poll(() => onDisk(daily, today))
      .toMatchObject([
        { text: 'Buy milk' },
        { text: 'Write the report', status: 'done', sticky: { since: day(-2) } }
      ])

    await daily.box('Write the report').uncheck()

    await expect(daily.ring).toHaveAttribute('aria-valuetext', '1 of 1 resolved')
    await expect(daily.carried).toHaveText(['Write the report'])
  })

  test('a ticked sticky stays on today when the day changes', async ({ daily }) => {
    await daily.box('Write the report').check()
    await expect.poll(() => onDisk(daily, today)).toMatchObject([{}, { status: 'done' }])

    await daily.morningOf(1)

    await expect(daily.page.getByText('Nothing planned for today.')).toBeVisible()
    await expect.poll(() => onDisk(daily, today)).toHaveLength(2)
    await expect.poll(() => daily.todos()).not.toHaveProperty(day(1))

    await daily.page.getByRole('button', { name: 'Previous day' }).click()

    await expect(daily.own).toHaveText(['Buy milk', 'Write the report'])
    await expect(daily.carried).toHaveCount(0)
  })
})

test.describe('sticking', () => {
  test.use({
    seed: {
      [day(-2)]: [todo('Renew the passport'), todo('Sort the photos')],
      [today]: [todo('Buy milk')],
      [day(1)]: [todo('Dentist, 9:30', 'open', [todo('Bring the card')])]
    }
  })

  test('on today keeps it on today, carried from today', async ({ daily }) => {
    await stick(daily, 'Buy milk')

    await expect(daily.carried).toHaveText(['Buy milk'])
    await expect.poll(() => onDisk(daily, today)).toMatchObject([{ sticky: { since: today } }])
    await expect(daily.line('Buy milk')).toHaveAttribute('data-age', '0')
    await tabToPin(daily, 'Buy milk')
    await expect(daily.tip).toHaveText('Since today')
    await expect(daily.stick('Buy milk')).toHaveAttribute('aria-pressed', 'true')
  })

  test('on a past day moves it to today at once, its age from that day', async ({ daily }) => {
    await back(daily, 2)
    await stick(daily, 'Renew the passport')

    await expect(daily.row('Renew the passport')).toBeHidden()
    await expect(daily.row('Sort the photos')).toBeVisible()
    await expect
      .poll(() => daily.todos())
      .toMatchObject({
        [day(-2)]: [{ text: 'Sort the photos' }],
        [today]: [{ text: 'Buy milk' }, { text: 'Renew the passport', sticky: { since: day(-2) } }]
      })

    await daily.page.getByRole('button', { name: 'Back to today' }).click()

    await expect(daily.carried).toHaveText(['Renew the passport'])
  })

  test('on a future day leaves it there until that day comes', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Next day' }).click()
    await stick(daily, 'Dentist, 9:30')

    await expect(daily.carried).toHaveText(['Dentist, 9:30'])
    await expect(daily.step('Bring the card')).toBeVisible()
    await expect.poll(() => onDisk(daily, day(1))).toMatchObject([{ sticky: { since: day(1) } }])
    await expect(daily.age('Dentist, 9:30')).toHaveCount(1)
    await tabToPin(daily, 'Dentist, 9:30')
    await expect(daily.tip).toHaveText(sinceText(day(1), -1))
    await daily.page.getByRole('button', { name: 'Back to today' }).click()
    await expect(daily.carried).toHaveCount(0)
  })

  test('on a future day, then moved to today, ages from today', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Next day' }).click()
    await stick(daily, 'Dentist, 9:30')
    await daily.act('Dentist, 9:30', 'Move to today: Dentist, 9:30')
    await daily.page.getByRole('button', { name: 'Back to today' }).click()

    await expect(daily.carried).toHaveText(['Dentist, 9:30'])
    await expect.poll(() => onDisk(daily, today)).toMatchObject([{}, { sticky: { since: today } }])
    await tabToPin(daily, 'Dentist, 9:30')
    await expect(daily.tip).toHaveText('Since today')
  })

  test('is offered on an open todo only, never on a step or a done todo', async ({ daily }) => {
    await daily.page.getByRole('button', { name: 'Next day' }).click()
    expect(await daily.actions('Dentist, 9:30')).toEqual([
      'Carry until done: Dentist, 9:30',
      'Move to today: Dentist, 9:30',
      'Delete Dentist, 9:30'
    ])
    await expect(daily.stick('Dentist, 9:30')).toHaveAttribute('aria-pressed', 'false')
    await tabToPin(daily, 'Dentist, 9:30')
    await expect(daily.tip).toHaveText('Carry until done')
    expect(await daily.actions('Bring the card')).toEqual(['Delete Bring the card'])

    await daily.box('Dentist, 9:30').check()

    expect(await daily.actions('Dentist, 9:30')).toEqual(['Delete Dentist, 9:30'])
  })
})

test.describe('the day changing while the app is open', () => {
  test.use({
    seed: {
      [today]: [todo('Buy milk'), stuck('Write the report', day(-1), [todo('Outline'), todo('Draft')])],
      [day(1)]: [todo('Dentist, 9:30')]
    }
  })

  test('carries the sticky to the new today, with its steps', async ({ daily }) => {
    await expect(daily.carried).toHaveText(['Write the report'])

    await daily.morningOf(1)

    await expect(daily.row('Dentist, 9:30')).toBeVisible()
    await expect(daily.carried).toHaveText(['Write the report'])
    await expect(daily.step('Draft')).toBeVisible()
    await expect
      .poll(() => daily.todos())
      .toMatchObject({
        [today]: [{ text: 'Buy milk' }],
        [day(1)]: [{ text: 'Dentist, 9:30' }, { text: 'Write the report', steps: [{}, {}] }]
      })
    await tabToPin(daily, 'Write the report')
    await expect(daily.tip).toHaveText(sinceText(day(-1), 2))
  })

  test('a sticky moved to tomorrow waits there, then travels on', async ({ daily }) => {
    await daily.act('Write the report', 'Move to tomorrow: Write the report')

    await expect(daily.carried).toHaveCount(0)
    await expect.poll(() => onDisk(daily, day(1))).toMatchObject([{}, { text: 'Write the report' }])

    await daily.morningOf(3)

    await expect(daily.carried).toHaveText(['Write the report'])
    await expect.poll(() => daily.todos()).toMatchObject({ [day(3)]: [{ text: 'Write the report' }] })
    await expect.poll(() => onDisk(daily, day(1))).toHaveLength(1)
  })
})

test.describe('a sticky with its steps folded', () => {
  const report: Todo = {
    ...stuck('Write the report', day(-3), [todo('Outline'), todo('Draft')]),
    folded: true
  }
  test.use({ seed: { [day(-3)]: [report] } })

  test('travels folded, and unfolds on today', async ({ daily }) => {
    await expect(daily.carried).toHaveText(['Write the report'])
    await expect(daily.step('Outline')).toBeHidden()
    await expect.poll(() => onDisk(daily, today)).toStrictEqual([report])

    await daily.chevron('Write the report').click()

    await expect(daily.step('Outline')).toBeVisible()
  })
})

test.describe('many stickies', () => {
  const many = Array.from({ length: 25 }, (_, i) => stuck(`Carry ${String(i + 1)}`, day(-1 - (i % 5))))
  test.use({
    seed: Object.fromEntries(
      [1, 2, 3, 4, 5].map((back) => [day(-back), many.filter((_, i) => i % 5 === back - 1)])
    )
  })

  test('all land on today, oldest day first, and the card still adds a todo', async ({ daily }) => {
    const order = [5, 4, 3, 2, 1].flatMap((back) => many.filter((_, i) => i % 5 === back - 1))
    await expect(daily.carried).toHaveText(order.map((entry) => entry.text))
    await expect(daily.page.getByText('Nothing planned for today.')).toBeVisible()
    await expect.poll(() => daily.todos()).toStrictEqual({ [today]: order })

    await daily.add('Buy milk')

    await expect(daily.own).toHaveText(['Buy milk'])
    await expect(daily.input).toBeInViewport()
    await expect(daily.ring).toHaveAttribute('aria-valuetext', '0 of 1 resolved')
  })
})

test.describe('a done sticky on a past card', () => {
  const report: Todo = { ...stuck('Write the report', day(-3)), status: 'done' }
  test.use({ seed: { [day(-1)]: [report, todo('Call the bank', 'done')] } })

  const card = (daily: Daily) => daily.page.locator('section[data-offset="0"]')

  test('unticked by the pointer, goes to today, and the row that slides under the pointer takes no click', async ({
    daily
  }) => {
    await back(daily, 1)
    let last = ''
    await expect
      .poll(async () => {
        const now = JSON.stringify(await boxOf(daily.box('Write the report')))
        const same = now === last
        last = now
        await daily.page.waitForTimeout(100)
        return same
      })
      .toBe(true)
    const box = await boxOf(daily.box('Write the report'))
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await daily.page.mouse.move(at.x, at.y)
    await daily.page.mouse.down()
    await daily.page.mouse.up()

    await expect(daily.row('Write the report')).toHaveCount(0)
    await expect
      .poll(() => onDisk(daily, today))
      .toMatchObject([{ status: 'open', sticky: { since: day(-3) } }])
    await expect(card(daily)).toHaveAttribute('data-guard')
    await expect
      .poll(() =>
        daily.page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-todo]')?.textContent,
          at
        )
      )
      .toContain('Call the bank')
    await daily.page.mouse.down()
    await daily.page.mouse.up()
    await daily.page.waitForTimeout(700)
    expect(await onDisk(daily, day(-1))).toMatchObject([{ text: 'Call the bank', status: 'done' }])

    await daily.page.mouse.move(at.x + 4, at.y)
    await expect(card(daily)).not.toHaveAttribute('data-guard')
    await daily.page.mouse.down()
    await daily.page.mouse.up()
    await expect.poll(() => onDisk(daily, day(-1))).toMatchObject([{ text: 'Call the bank', status: 'open' }])
  })

  test('unticked from the keyboard, goes to today and hands the focus to the next row', async ({ daily }) => {
    await back(daily, 1)
    await daily.box('Write the report').focus()
    await daily.page.keyboard.press('Space')

    await expect(daily.row('Write the report')).toHaveCount(0)
    await expect(daily.editButton('Call the bank')).toBeFocused()
    await expect
      .poll(() => onDisk(daily, today))
      .toMatchObject([{ status: 'open', sticky: { since: day(-3) } }])
  })
})
