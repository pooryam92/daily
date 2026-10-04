// The geometry of a held row is read in the page, which needs the DOM types.
/// <reference lib="dom" />

import { expect, test, todo, today } from './daily'
import type { Daily } from './daily'
import type { DaysMap, Todo } from '../src/domain/todo'

/*
 * A row is dropped onto a row, and nothing moves while it is held: a row's top quarter is "above", its
 * bottom quarter "below", and a todo's middle "into" (a step's middle splits at its centre).
 */
/** Where the middle of a row starts and ends, from its top (ZONE_EDGE in rowDrag.ts). */
const EDGE = 0.25
/** Points well inside each zone of a row, for quarters and for thirds alike. */
const ABOVE = 0.12
const INTO = 0.5
const BELOW = 0.88

const LINE = '[data-drop-line]'
const TINT = 'li[data-drop-target]'
const COPY = '[data-drag-copy]'
/** What is read out without being shown: a status says its changes politely, without `aria-live`. */
const LIVE = '[role="status"], [aria-live]'
/** Every row's text in the order it is shown, steps under their todo. */
const SHOWN = 'li[data-todo] > div [data-todo-text] > span:first-child'

const milk = todo('Buy milk')
const workflow = todo('Add the workflow file')
const lint = todo('Fix the lint errors')
const cache = todo('Cache the dependencies')
const ci = todo('Set up CI', 'open', [workflow, lint, cache])
const taxes = todo('Do the taxes')
const flights = todo('Book the flights')
const hotel = todo('Find a hotel')
const trip = todo('Plan the trip', 'open', [flights, hotel])
const dust = todo('Dust the shelves')
const mop = todo('Mop the floor')
const house = todo('Clean the house', 'open', [dust, mop])
const plants = todo('Water the plants')
const rent = todo('Pay the rent', 'done')

const folded = (parent: Todo): Todo => ({ ...parent, folded: true })
const under = (parent: Todo, steps: readonly Todo[]): Todo => ({ ...parent, steps })
const on = (todos: readonly Todo[]): DaysMap => ({ [today]: todos })

interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Every row's own line (a todo's without its steps) by its text, and how far the list is scrolled. */
interface Rows {
  readonly rows: Readonly<Record<string, Box>>
  readonly list: Box
  readonly scroll: number
}

const measure = (daily: Daily): Promise<Rows> =>
  daily.page.evaluate(() => {
    const rows: Record<string, Box> = {}
    for (const li of document.querySelectorAll('li[data-todo]')) {
      const line = li.querySelector(':scope > div')
      const label = line?.querySelector('[aria-label^="Edit "]')?.getAttribute('aria-label')
      if (line === null || label === null || label === undefined) continue
      const { x, y, width, height } = line.getBoundingClientRect()
      rows[label.slice('Edit '.length)] = { x, y, width, height }
    }
    const list = document.querySelector('li[data-todo]:not([data-step])')?.parentElement
    const box = list?.getBoundingClientRect()
    return {
      rows,
      list: { x: box?.x ?? 0, y: box?.y ?? 0, width: box?.width ?? 0, height: box?.height ?? 0 },
      scroll: list?.scrollTop ?? 0
    }
  })

const boxOf = (rows: Rows, text: string): Box => {
  const box = rows.rows[text]
  if (box === undefined) throw new Error(`${text} is not shown`)
  return box
}

/** A point on `text`'s line, `at` of the way down it. */
const aim = (rows: Rows, text: string, at: number) => {
  const box = boxOf(rows, text)
  return { x: box.x + box.width * 0.3, y: box.y + box.height * at }
}

const frames = (daily: Daily) =>
  daily.page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            done()
          })
        )
      )
  )

/** Every row is where it was in the list: nothing shuffles while a row is held. */
async function steady(daily: Daily, before: Rows, when: string): Promise<void> {
  const now = await measure(daily)
  const moved = Object.entries(before.rows).flatMap(([text, box]) => {
    const at = now.rows[text]
    if (at === undefined) return [`${text} is gone`]
    const dy = at.y + now.scroll - (box.y + before.scroll)
    const dx = at.x - box.x
    return Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
      ? [`${text} moved ${dx.toFixed(1)}, ${dy.toFixed(1)}`]
      : []
  })
  expect(moved, when).toEqual([])
}

interface Held {
  readonly text: string
  /** The rows as they were when it was picked up. */
  readonly before: Rows
  point: { x: number; y: number }
}

/** Waits until no row moves between two looks 100ms apart: the last drop's slide is over. */
async function still(daily: Daily): Promise<void> {
  let last = JSON.stringify(await measure(daily))
  await expect
    .poll(async () => {
      await daily.page.waitForTimeout(100)
      const now = JSON.stringify(await measure(daily))
      const same = now === last
      last = now
      return same
    })
    .toBe(true)
}

/**
 * How opaque the held row's text button, box and steps look, through every ancestor's opacity and opacity
 * filter (Motion holds the row's own). The text button is spared so its focus ring keeps its strength.
 */
const dimmed = (daily: Daily) =>
  daily.page.evaluate(() => {
    const shown = (element: Element | null | undefined) => {
      if (element === null || element === undefined) return undefined
      let value = 1
      for (let at: Element | null = element; at !== null; at = at.parentElement) {
        const style = getComputedStyle(at)
        const filter = /opacity\(([\d.]+)\)/.exec(style.filter)?.[1]
        value *= Number(style.opacity) * Number(filter ?? 1)
      }
      return value
    }
    const li = document.querySelector('li[data-dragging]')
    const line = li?.querySelector(':scope > div')
    const label = line?.querySelector('[aria-label^="Edit "]')
    return {
      label: label?.getAttribute('aria-label'),
      text: shown(label),
      words: shown(label?.querySelector('span')),
      box: shown(line?.querySelector('input[type="checkbox"] + svg')),
      steps: shown(li?.querySelector(':scope ul'))
    }
  })

/**
 * Picks `text` up by its words with the pointer. The row stays where it was, dimmed, and a copy
 * follows the pointer.
 */
async function pickUp(daily: Daily, text: string): Promise<Held> {
  // For a moment after a drop a moved row is there twice, one leaving and one arriving.
  await expect(daily.editButton(text)).toHaveCount(1)
  // A row below the list's visible bottom is under whatever is drawn there: bring it into view.
  await daily.editButton(text).scrollIntoViewIfNeeded()
  await still(daily)
  const before = await measure(daily)
  const box = await daily.editButton(text).locator('span').first().boundingBox()
  if (box === null) throw new Error(`The words of ${text} are not shown`)
  const point = { x: box.x + Math.min(8, box.width / 2), y: box.y + box.height / 2 }
  await daily.page.mouse.move(point.x, point.y)
  await daily.page.mouse.down()
  point.y += 10
  await daily.page.mouse.move(point.x, point.y, { steps: 2 })
  await expect(daily.page.locator('li[data-dragging]')).toHaveCount(1)
  await frames(daily)
  const held: Held = { text, before, point }
  await steady(daily, before, `${text} picked up`)
  const dim = await dimmed(daily)
  expect(dim.label).toBe(`Edit ${text}`)
  expect(dim.box, 'the source row’s box').toBeCloseTo(0.4, 1)
  expect(dim.words, 'the source row’s words').toBeCloseTo(0.4, 1)
  if (dim.steps !== undefined) expect(dim.steps, 'the source row’s steps').toBeCloseTo(0.4, 1)
  await copyFollows(daily, held)
  return held
}

/**
 * The copy is a chip beside the pointer, never over it: 16px right of it and 24px below. Near the list's
 * right edge it shifts left to stay 8px inside; near the bottom it flips to 24px above the pointer.
 */
async function copyFollows(daily: Daily, held: Held): Promise<void> {
  const chip = daily.page.locator(COPY)
  await expect(chip).toHaveCount(1)
  await expect(chip).toContainText(held.text)
  const copy = await chip.boundingBox()
  if (copy === null) throw new Error('No copy follows the pointer')
  const { x, y } = held.point
  const right = held.before.list.x + held.before.list.width - 8
  const when = `copy ${JSON.stringify(copy)}, pointer ${JSON.stringify(held.point)}, list right − 8 = ${String(right)}`
  const near = (a: number, b: number) => Math.abs(a - b) <= 2
  expect(near(copy.x, x + 16) || (copy.x < x + 16 && near(copy.x + copy.width, right)), when).toBe(true)
  expect(near(copy.y, y + 24) || near(copy.y + copy.height, y - 24), when).toBe(true)
  expect(copy.width, when).toBeLessThanOrEqual(280)
}

/** Glides the held row to a point in ten moves, and checks at each that no row has moved. */
async function glide(daily: Daily, held: Held, to: { x: number; y: number }): Promise<void> {
  const from = { ...held.point }
  for (let i = 1; i <= 10; i++) {
    held.point = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 }
    await daily.page.mouse.move(held.point.x, held.point.y)
    await frames(daily)
    await steady(daily, held.before, `${held.text} on its way, move ${String(i)}`)
  }
  await copyFollows(daily, held)
}

/** Glides the held row to `at` of the way down `onto`'s line, as it was measured at pick-up. */
const over = (daily: Daily, held: Held, onto: string, at: number) =>
  glide(daily, held, aim(held.before, onto, at))

/** Drags `text` to `at` of the way down `onto`, runs `during` there, and drops it. */
async function drop(
  daily: Daily,
  text: string,
  onto: string,
  at: number,
  during: (held: Held) => Promise<void> = () => Promise.resolve()
): Promise<void> {
  const held = await pickUp(daily, text)
  await over(daily, held, onto, at)
  await during(held)
  // A pointer is told the place once it rests there for 300ms.
  await daily.page.waitForTimeout(400)
  await daily.page.mouse.up()
}

async function line(daily: Daily): Promise<Box> {
  const box = await daily.page.locator(LINE).boundingBox()
  if (box === null) throw new Error('No drop line is shown')
  return box
}

/**
 * What the held row shows: a line at a depth, near `near` (a height in the page) when given, or the
 * tinted todo it goes into and no line. A step line also tints `of`, the todo the row will be a step of.
 */
async function shows(
  daily: Daily,
  what:
    | { readonly line: 'todo'; readonly near?: number }
    | { readonly line: 'step'; readonly of: string; readonly near?: number }
    | { readonly into: string }
): Promise<void> {
  if ('into' in what) {
    await expect(daily.page.locator(TINT)).toHaveCount(1)
    await expect(daily.row(what.into)).toHaveAttribute('data-drop-target')
    await expect(daily.page.locator(LINE)).toHaveCount(0)
    return
  }
  await expect(daily.page.locator(LINE)).toHaveCount(1)
  await expect(daily.page.locator(LINE)).toHaveAttribute('data-depth', what.line)
  // A step line tints the todo the row will be a step of, so it shows when that todo is scrolled out.
  if (what.line === 'step') {
    await expect(daily.page.locator(TINT)).toHaveCount(1)
    await expect(daily.row(what.of)).toHaveAttribute('data-drop-target')
  } else await expect(daily.page.locator(TINT)).toHaveCount(0)
  if (what.near !== undefined) {
    const box = await line(daily)
    expect(Math.abs(box.y + box.height / 2 - what.near), JSON.stringify(box)).toBeLessThanOrEqual(8)
  }
}

const top = (rows: Rows, text: string) => boxOf(rows, text).y
const bottom = (rows: Rows, text: string) => boxOf(rows, text).y + boxOf(rows, text).height

/** Starts writing down every line the live regions say. Returns what has been heard so far. */
async function listen(daily: Daily): Promise<() => Promise<string[]>> {
  await daily.page.evaluate((live) => {
    const heard: string[] = []
    Object.assign(window, { heard })
    new MutationObserver((records) => {
      for (const record of records) {
        const node = record.target instanceof Element ? record.target : record.target.parentElement
        const text = node?.closest(live)?.textContent.trim() ?? ''
        if (text !== '' && heard.at(-1) !== text) heard.push(text)
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  }, LIVE)
  return () => daily.page.evaluate(() => (window as unknown as { heard: string[] }).heard)
}

/** The words begin as given; the rest of each line is uiux's table. */
const begins = (words: string) => new RegExp(`^${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

/**
 * Focuses a row's text once the row is there only once. For a moment after a drop it is there more
 * than once (the copy leaving, the row arriving), and a text focused then does not pick up.
 */
async function hold(daily: Daily, text: string): Promise<void> {
  await expect(daily.editButton(text)).toHaveCount(1)
  await daily.page.waitForTimeout(500)
  await daily.editButton(text).focus()
}

/** Picks a row up by its text from the keyboard, presses `keys` one by one, and drops it with Space. */
async function carry(daily: Daily, text: string, keys: readonly string[], during = () => Promise.resolve()) {
  await hold(daily, text)
  await daily.page.keyboard.press('Space')
  await daily.page.waitForTimeout(150)
  // No copy for the keyboard: the lifted row, the line and the focus on its text carry it.
  await expect(daily.page.locator(COPY)).toHaveCount(0)
  await expect(daily.page.locator('li[data-dragging]')).toHaveCount(1)
  const dim = await dimmed(daily)
  expect.soft(dim.label, `${text} lifted`).toBe(`Edit ${text}`)
  // Dimmed like a pointer drag, all but the focused text, whose focus ring keeps its strength.
  expect.soft(dim.box, `${text}'s box`).toBeCloseTo(0.4, 1)
  expect.soft(dim.words, `${text}'s words`).toBeCloseTo(0.4, 1)
  expect.soft(dim.text, `${text}'s focused text`).toBe(1)
  await expect(daily.editButton(text)).toBeFocused()
  for (const key of keys) {
    await daily.page.keyboard.press(key)
    await daily.page.waitForTimeout(350)
  }
  await during()
  await daily.page.keyboard.press('Space')
}

/** Nothing is saved: what is on disk is still `days` a while after the drop. */
async function unchanged(daily: Daily, days: DaysMap): Promise<void> {
  await daily.page.waitForTimeout(600)
  expect(await daily.todos()).toStrictEqual(days)
}

/** What is saved becomes `days`, and the list shows `shown` from the top. */
async function saved(daily: Daily, days: DaysMap, shown?: readonly string[]): Promise<void> {
  await expect.poll(() => daily.todos()).toStrictEqual(days)
  if (shown !== undefined) await expect(daily.page.locator(SHOWN)).toHaveText([...shown])
  await expect(daily.page.locator(LINE)).toHaveCount(0)
  await expect(daily.page.locator(TINT)).toHaveCount(0)
}

/**
 * A window tall enough for every row of a seed to show. The list scrolls only while the pointer is
 * held past its edge, so a row below its visible bottom cannot be aimed at.
 */
async function roomy(daily: Daily): Promise<void> {
  await daily.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1000, 1000)
  })
  await expect.poll(() => daily.page.evaluate(() => window.innerHeight)).toBe(1000)
  await expect
    .poll(() =>
      daily.page.evaluate(() => {
        const list = document.querySelector('li[data-todo]:not([data-step])')?.parentElement
        return list ? list.scrollHeight - list.clientHeight : -1
      })
    )
    .toBeLessThanOrEqual(0)
}

test.describe('dropping a row onto a row', () => {
  test.describe('by pointer', () => {
    const seed = [milk, ci, taxes, trip, folded(house), plants, rent]
    test.use({ seed: on(seed) })
    test.beforeEach(({ daily }) => roomy(daily))

    test('a todo dropped on the top quarter of a row several rows down, or up, goes just above it', async ({
      daily
    }) => {
      const heard = await listen(daily)
      await drop(daily, 'Buy milk', 'Water the plants', ABOVE, async (held) => {
        await shows(daily, { line: 'todo', near: top(held.before, 'Water the plants') })
      })
      await saved(daily, on([ci, taxes, trip, folded(house), milk, plants, rent]))
      expect.soft(await heard()).toContainEqual(expect.stringMatching(begins('Above Water the plants')))

      await drop(daily, 'Water the plants', 'Set up CI', ABOVE, async (held) => {
        await shows(daily, { line: 'todo', near: top(held.before, 'Set up CI') })
      })
      await saved(daily, on([plants, ci, taxes, trip, folded(house), milk, rent]), [
        'Water the plants',
        'Set up CI',
        'Add the workflow file',
        'Fix the lint errors',
        'Cache the dependencies',
        'Do the taxes',
        'Plan the trip',
        'Book the flights',
        'Find a hotel',
        'Clean the house',
        'Buy milk',
        'Pay the rent'
      ])
    })

    test('a todo dropped on the bottom quarter of a todo without steps goes just below it', async ({
      daily
    }) => {
      await drop(daily, 'Buy milk', 'Do the taxes', BELOW, async (held) => {
        await shows(daily, { line: 'todo', near: bottom(held.before, 'Do the taxes') })
      })
      await saved(daily, on([ci, taxes, milk, trip, folded(house), plants, rent]))
    })

    test('a todo dropped on the middle of a todo becomes its last step, and a folded one unfolds', async ({
      daily
    }) => {
      const heard = await listen(daily)
      await drop(daily, 'Water the plants', 'Do the taxes', INTO, async () => {
        await shows(daily, { into: 'Do the taxes' })
      })
      await saved(daily, on([milk, ci, under(taxes, [plants]), trip, folded(house), rent]))
      expect.soft(await heard()).toContainEqual(expect.stringMatching(begins('Into Do the taxes')))

      await drop(daily, 'Buy milk', 'Clean the house', INTO, async () => {
        await shows(daily, { into: 'Clean the house' })
      })
      await saved(daily, on([ci, under(taxes, [plants]), trip, under(house, [dust, mop, milk]), rent]))
      await expect(daily.chevron('Clean the house')).toHaveAttribute('aria-expanded', 'true')
    })

    test('a release with no rest lands where the line or the tint shows, drag after drag', async ({
      daily
    }) => {
      // The 300ms rest is for the words only: what shows is where it lands.
      const quick = async (text: string, onto: string, at: number, check: (held: Held) => Promise<void>) => {
        const held = await pickUp(daily, text)
        await over(daily, held, onto, at)
        await check(held)
        await daily.page.mouse.up()
      }
      await quick('Water the plants', 'Do the taxes', INTO, () => shows(daily, { into: 'Do the taxes' }))
      await saved(daily, on([milk, ci, under(taxes, [plants]), trip, folded(house), rent]))
      await quick('Buy milk', 'Clean the house', INTO, () => shows(daily, { into: 'Clean the house' }))
      await saved(daily, on([ci, under(taxes, [plants]), trip, under(house, [dust, mop, milk]), rent]))
      await quick('Buy milk', 'Set up CI', ABOVE, (held) =>
        shows(daily, { line: 'todo', near: top(held.before, 'Set up CI') })
      )
      await saved(daily, on([milk, ci, under(taxes, [plants]), trip, house, rent]))
    })

    test('a todo dropped on the bottom quarter of an unfolded todo with steps becomes its first step', async ({
      daily
    }) => {
      await drop(daily, 'Do the taxes', 'Set up CI', BELOW, async (held) => {
        await shows(daily, { line: 'step', of: 'Set up CI', near: bottom(held.before, 'Set up CI') })
      })
      await saved(
        daily,
        on([milk, under(ci, [taxes, workflow, lint, cache]), trip, folded(house), plants, rent])
      )
    })

    test('dropped above or below a step, a todo goes between the steps, and a step goes to another todo', async ({
      daily
    }) => {
      const heard = await listen(daily)
      await drop(daily, 'Buy milk', 'Fix the lint errors', ABOVE, async (held) => {
        await shows(daily, { line: 'step', of: 'Set up CI', near: top(held.before, 'Fix the lint errors') })
      })
      await saved(
        daily,
        on([under(ci, [workflow, milk, lint, cache]), taxes, trip, folded(house), plants, rent])
      )
      expect
        .soft(await heard())
        .toContainEqual(expect.stringMatching(begins('Step of Set up CI, after Add the workflow file')))

      await drop(daily, 'Add the workflow file', 'Book the flights', BELOW, async (held) => {
        await shows(daily, {
          line: 'step',
          of: 'Plan the trip',
          near: bottom(held.before, 'Book the flights')
        })
      })
      await saved(
        daily,
        on([
          under(ci, [milk, lint, cache]),
          taxes,
          under(trip, [flights, workflow, hotel]),
          folded(house),
          plants,
          rent
        ])
      )
      expect
        .soft(await heard())
        .toContainEqual(expect.stringMatching(begins('Step of Plan the trip, after Book the flights')))
    })

    test('the middle of a step splits at its centre: above in the upper half, below in the lower', async ({
      daily
    }) => {
      // Clear of the centre by more than the 2px a zone holds past its edge.
      await drop(daily, 'Fix the lint errors', 'Find a hotel', 0.4, async (held) => {
        await shows(daily, { line: 'step', of: 'Plan the trip', near: top(held.before, 'Find a hotel') })
      })
      await saved(
        daily,
        on([
          milk,
          under(ci, [workflow, cache]),
          taxes,
          under(trip, [flights, lint, hotel]),
          folded(house),
          plants,
          rent
        ])
      )

      await drop(daily, 'Fix the lint errors', 'Find a hotel', 0.6, async (held) => {
        await shows(daily, { line: 'step', of: 'Plan the trip', near: bottom(held.before, 'Find a hotel') })
      })
      await saved(
        daily,
        on([
          milk,
          under(ci, [workflow, cache]),
          taxes,
          under(trip, [flights, hotel, lint]),
          folded(house),
          plants,
          rent
        ])
      )
    })

    test('below a last step is a step at its end, above the next todo is a todo: the line’s indent tells them apart', async ({
      daily
    }) => {
      const column = async (text: string) => {
        const box = await daily.page
          .locator(SHOWN)
          .filter({ hasText: new RegExp(`^${text}$`) })
          .boundingBox()
        if (box === null) throw new Error(`${text} is not shown`)
        return box.x
      }
      const [stepColumn, todoColumn] = [await column('Add the workflow file'), await column('Do the taxes')]
      expect(stepColumn).toBeGreaterThan(todoColumn)

      await drop(daily, 'Buy milk', 'Cache the dependencies', BELOW, async (held) => {
        await shows(daily, {
          line: 'step',
          of: 'Set up CI',
          near: bottom(held.before, 'Cache the dependencies')
        })
        const stepLine = (await line(daily)).x
        await over(daily, held, 'Do the taxes', ABOVE)
        await shows(daily, { line: 'todo', near: top(held.before, 'Do the taxes') })
        expect(Math.abs(stepLine - (await line(daily)).x - (stepColumn - todoColumn))).toBeLessThanOrEqual(2)
      })
      await saved(daily, on([ci, milk, taxes, trip, folded(house), plants, rent]))

      await drop(daily, 'Buy milk', 'Cache the dependencies', BELOW)
      await saved(
        daily,
        on([under(ci, [workflow, lint, cache, milk]), taxes, trip, folded(house), plants, rent])
      )
    })

    test('the spacer under the steps is never a target: its upper half is a step at the end, its lower half the todo after', async ({
      daily
    }) => {
      const adds = daily.page.locator('li[data-add-step]')
      const ciAdds = daily.row('Set up CI').locator('li[data-add-step]')
      const heard = await listen(daily)
      const half = async (held: Held, at: number) => {
        const box = await ciAdds.boundingBox()
        if (box === null) throw new Error('Set up CI has no spacer under its steps')
        await glide(daily, held, { x: box.x + box.width * 0.3, y: box.y + box.height * at })
        await expect(adds.locator('[data-drop-line]')).toHaveCount(0)
        await expect(daily.page.locator('li[data-add-step][data-drop-target]')).toHaveCount(0)
      }

      let held = await pickUp(daily, 'Buy milk')
      await half(held, 0.25)
      await shows(daily, {
        line: 'step',
        of: 'Set up CI',
        near: bottom(held.before, 'Cache the dependencies')
      })
      await half(held, 0.75)
      await shows(daily, { line: 'todo', near: top(held.before, 'Do the taxes') })
      await daily.page.waitForTimeout(400)
      await daily.page.mouse.up()
      await saved(daily, on([ci, milk, taxes, trip, folded(house), plants, rent]))
      expect
        .soft(await heard())
        .toContainEqual(expect.stringMatching(begins('Dropped Buy milk, above Do the taxes')))

      held = await pickUp(daily, 'Buy milk')
      await half(held, 0.25)
      await shows(daily, {
        line: 'step',
        of: 'Set up CI',
        near: bottom(held.before, 'Cache the dependencies')
      })
      await daily.page.waitForTimeout(400)
      await daily.page.mouse.up()
      await saved(
        daily,
        on([under(ci, [workflow, lint, cache, milk]), taxes, trip, folded(house), plants, rent])
      )

      // The last step over the row under it is where it was: nothing is saved. Its place has not
      // changed since it was picked up, so no place is said until the drop.
      held = await pickUp(daily, 'Buy milk')
      await half(held, 0.25)
      await shows(daily, { line: 'step', of: 'Set up CI' })
      await daily.page.waitForTimeout(400)
      await daily.page.mouse.up()
      await unchanged(
        daily,
        on([under(ci, [workflow, lint, cache, milk]), taxes, trip, folded(house), plants, rent])
      )
      expect.soft(await heard()).toContain('Dropped Buy milk where it was.')
    })

    test('a todo dropped in the free space under the rows goes to the end of the open part', async ({
      daily
    }) => {
      const held = await pickUp(daily, 'Buy milk')
      const last = bottom(held.before, 'Pay the rent')
      const end = held.before.list.y + held.before.list.height
      expect(end - last, 'free space under the rows, in the list').toBeGreaterThan(20)
      await glide(daily, held, { x: held.before.list.x + held.before.list.width * 0.3, y: (last + end) / 2 })
      await shows(daily, { line: 'todo' })
      await daily.page.mouse.up()
      await saved(daily, on([ci, taxes, trip, folded(house), plants, milk, rent]))
    })

    test('a step dropped in any top-level gap becomes a todo there, keeps its status, and a done one settles', async ({
      daily
    }) => {
      await expect(daily.ring).toHaveAttribute('aria-valuetext', '1 of 7 resolved')
      const heard = await listen(daily)
      await drop(daily, 'Fix the lint errors', 'Buy milk', ABOVE, async (held) => {
        await shows(daily, { line: 'todo', near: top(held.before, 'Buy milk') })
      })
      await saved(
        daily,
        on([lint, milk, under(ci, [workflow, cache]), taxes, trip, folded(house), plants, rent])
      )
      expect.soft(await heard()).toContainEqual(expect.stringMatching(begins('Above Buy milk')))
      await expect(daily.ring).toHaveAttribute('aria-valuetext', '1 of 8 resolved')

      await daily.box('Cache the dependencies').click()
      const done: Todo = { ...cache, status: 'done' }
      await saved(
        daily,
        on([lint, milk, under(ci, [workflow, done]), taxes, trip, folded(house), plants, rent])
      )
      await drop(daily, 'Cache the dependencies', 'Do the taxes', ABOVE)
      await saved(
        daily,
        on([lint, milk, under(ci, [workflow]), done, taxes, trip, folded(house), plants, rent])
      )
      // Done and out, it settles among the done todos, in the order they are kept in.
      await expect(daily.page.locator(SHOWN)).toHaveText([
        'Fix the lint errors',
        'Buy milk',
        'Set up CI',
        'Add the workflow file',
        'Do the taxes',
        'Plan the trip',
        'Book the flights',
        'Find a hotel',
        'Clean the house',
        'Water the plants',
        'Cache the dependencies',
        'Pay the rent'
      ])
      await expect(daily.ring).toHaveAttribute('aria-valuetext', '2 of 9 resolved')
    })

    test('a fast sweep across the rows says no place until the pointer rests, then says where it rests', async ({
      daily
    }) => {
      const heard = await listen(daily)
      const held = await pickUp(daily, 'Buy milk')
      const said = async () => (await heard()).filter((line) => !line.startsWith('Picked up '))
      const to = aim(held.before, 'Water the plants', ABOVE)
      // Across Set up CI, its steps, Do the taxes, Plan the trip and the rest in about 100ms.
      await daily.page.mouse.move(to.x, to.y, { steps: 12 })
      held.point = to
      await daily.page.waitForTimeout(150)
      expect(await said()).toEqual([])
      await daily.page.waitForTimeout(400)
      expect(await said()).toEqual([expect.stringMatching(begins('Above Water the plants'))])
      await daily.page.keyboard.press('Escape')
      await daily.page.mouse.up()
      await unchanged(daily, on(seed))
    })

    test('Escape while a row is held, or a release outside the list, puts nothing anywhere', async ({
      daily
    }) => {
      const held = await pickUp(daily, 'Buy milk')
      await over(daily, held, 'Do the taxes', INTO)
      await shows(daily, { into: 'Do the taxes' })
      await daily.page.keyboard.press('Escape')
      await expect(daily.page.locator(TINT)).toHaveCount(0)
      await expect(daily.page.locator(LINE)).toHaveCount(0)
      await daily.page.mouse.up()
      await unchanged(daily, on(seed))
      await steady(daily, held.before, 'after Escape')

      const again = await pickUp(daily, 'Buy milk')
      const heading = await daily.heading('Today').boundingBox()
      if (heading === null) throw new Error('Today is not shown')
      await glide(daily, again, { x: heading.x + heading.width / 2, y: heading.y + heading.height / 2 })
      await daily.page.mouse.up()
      await unchanged(daily, on(seed))
      await steady(daily, again.before, 'after a release outside the list')
    })

    test('the copy of a todo with steps says how many are done, folded or not; a plain todo’s says nothing, and no pie anywhere', async ({
      daily
    }) => {
      /** The words seen on the copy: text in elements bigger than a pixel, so not reader-only text. */
      const copyWords = () =>
        daily.page.locator(COPY).evaluate((chip) =>
          [chip, ...chip.querySelectorAll('*')]
            .filter((el) => {
              const { width, height } = el.getBoundingClientRect()
              return width > 1 && height > 1
            })
            .flatMap((el) => [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE))
            .map((node) => node.textContent?.trim() ?? '')
            .filter((text) => text !== '')
            .join(' ')
        )
      for (const [text, shown] of [
        ['Set up CI', 'Set up CI 0/3'],
        ['Clean the house', 'Clean the house 0/2'],
        ['Buy milk', 'Buy milk']
      ] as const) {
        const held = await pickUp(daily, text)
        expect(await copyWords(), text).toBe(shown)
        await expect(daily.page.locator('[class*="_pie_"]'), text).toHaveCount(0)
        await daily.page.keyboard.press('Escape')
        await daily.page.mouse.up()
        await expect(daily.page.locator('li[data-dragging]')).toHaveCount(0)
        await steady(daily, held.before, `after ${text}`)
      }
      await expect(daily.chevron('Clean the house')).toHaveAttribute('aria-expanded', 'false')
      await unchanged(daily, on(seed))
    })

    test('a drop cannot be undone', async ({ daily }) => {
      await drop(daily, 'Buy milk', 'Do the taxes', BELOW)
      const moved = on([ci, taxes, milk, trip, folded(house), plants, rent])
      await saved(daily, moved)
      await daily.page.keyboard.press('Control+z')
      await unchanged(daily, moved)
    })

    test.describe('a stray pointer', () => {
      /** Starts writing down every pointer event the page gets. Returns what it has got so far. */
      async function pointers(daily: Daily) {
        await daily.page.evaluate(() => {
          const got: { type: string; pointerType: string; pointerId: number; buttons: number }[] = []
          Object.assign(window, { got })
          for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
            window.addEventListener(
              type,
              (event) => {
                const { pointerType, pointerId, buttons } = event as PointerEvent
                got.push({ type, pointerType, pointerId, buttons })
              },
              true
            )
          }
        })
        return () =>
          daily.page.evaluate(
            () =>
              (
                window as unknown as {
                  got: { type: string; pointerType: string; pointerId: number; buttons: number }[]
                }
              ).got
          )
      }

      /**
       * Holds Buy milk below Do the taxes, runs `stray` at the middle of Plan the trip, and checks that
       * the line and the copy stay, nothing more is said, and the drop lands below Do the taxes.
       */
      async function unmoved(daily: Daily, stray: (at: { x: number; y: number }) => Promise<void>) {
        const heard = await listen(daily)
        const held = await pickUp(daily, 'Buy milk')
        await over(daily, held, 'Do the taxes', BELOW)
        await daily.page.waitForTimeout(400)
        await shows(daily, { line: 'todo', near: bottom(held.before, 'Do the taxes') })
        const copy = await daily.page.locator(COPY).boundingBox()
        const said = await heard()

        await stray(aim(held.before, 'Plan the trip', INTO))
        await daily.page.waitForTimeout(400)

        await expect(daily.page.locator('li[data-dragging]')).toHaveCount(1)
        await shows(daily, { line: 'todo', near: bottom(held.before, 'Do the taxes') })
        const now = await daily.page.locator(COPY).boundingBox()
        expect(Math.abs((now?.x ?? 0) - (copy?.x ?? 0)), `copy ${JSON.stringify(now)}`).toBeLessThanOrEqual(1)
        expect(Math.abs((now?.y ?? 0) - (copy?.y ?? 0)), `copy ${JSON.stringify(now)}`).toBeLessThanOrEqual(1)
        expect(await heard(), 'nothing more is said').toEqual(said)
        await daily.page.mouse.up()
        await saved(daily, on([ci, taxes, milk, trip, folded(house), plants, rent]))
      }

      test('a mouse move with no button held, while a row is held, moves nothing: not the line, the copy or the drop', async ({
        daily
      }) => {
        // What the X cursor sends under xvfb: a real move, elsewhere, with no button down.
        const got = await pointers(daily)
        const cdp = await daily.page.context().newCDPSession(daily.page)
        await unmoved(daily, async ({ x, y }) => {
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
        })
        expect(await got(), 'the stray move reached the page').toContainEqual({
          type: 'pointermove',
          pointerType: 'mouse',
          pointerId: 1,
          buttons: 0
        })
      })

      test('a second pointer down, moved and up while a row is held moves nothing and drops nothing', async ({
        daily
      }) => {
        const got = await pointers(daily)
        const cdp = await daily.page.context().newCDPSession(daily.page)
        await unmoved(daily, async ({ x, y }) => {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 10, y: y + 4 }]
          })
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        })
        const touch = (await got()).filter((event) => event.pointerType === 'touch')
        expect(
          touch.map((event) => event.type),
          'the second pointer reached the page'
        ).toEqual(['pointerdown', 'pointermove', 'pointerup'])
        expect(touch.every((event) => event.pointerId !== 1)).toBe(true)
      })
    })
  })

  test.describe('refused by pointer', () => {
    const laundry = todo('Do the laundry', 'done')
    const iron = todo('Iron the shirts', 'done')
    const chores = todo('Do the chores', 'done', [laundry, iron])
    const seed = [milk, ci, taxes, trip, rent, chores]
    test.use({ seed: on(seed) })
    test.beforeEach(({ daily }) => roomy(daily))

    test('a todo with steps of its own takes the nearer half of a todo’s middle, and never a tint', async ({
      daily
    }) => {
      await drop(daily, 'Set up CI', 'Buy milk', 0.4, async (held) => {
        await shows(daily, { line: 'todo', near: top(held.before, 'Buy milk') })
      })
      await saved(daily, on([ci, milk, taxes, trip, rent, chores]))
      await drop(daily, 'Set up CI', 'Do the taxes', 0.6, async (held) => {
        await shows(daily, { line: 'todo', near: bottom(held.before, 'Do the taxes') })
      })
      await saved(daily, on([milk, taxes, ci, trip, rent, chores]))
    })

    test('a todo with steps of its own over a step snaps to a gap beside that step’s todo, and says why', async ({
      daily
    }) => {
      const heard = await listen(daily)
      await drop(daily, 'Set up CI', 'Book the flights', INTO, async () => {
        await shows(daily, { line: 'todo' })
        await expect(
          daily.page.locator(LIVE).filter({ hasText: begins("Can't be a step: it has steps of its own.") })
        ).toHaveCount(1)
      })
      expect(await heard()).toContainEqual(
        expect.stringMatching(begins("Can't be a step: it has steps of its own."))
      )
      await expect
        .poll(async () => {
          const list = (await daily.todos())[today] ?? []
          const [at, beside] = [
            list.findIndex((entry) => entry.id === ci.id),
            list.findIndex((entry) => entry.id === trip.id)
          ]
          return Math.abs(at - beside) === 1 && list.find((entry) => entry.id === ci.id)?.steps?.length === 3
        })
        .toBe(true)
    })

    test('a row over itself is placed nowhere', async ({ daily }) => {
      for (const at of [ABOVE, INTO, BELOW]) {
        await drop(daily, 'Buy milk', 'Buy milk', at, async () => {
          await expect(daily.page.locator(TINT)).toHaveCount(0)
        })
        await unchanged(daily, on(seed))
      }
    })

    test('over the done todos, an open row’s line holds at the end of the open part', async ({ daily }) => {
      for (const onto of ['Pay the rent', 'Iron the shirts']) {
        const held = await pickUp(daily, 'Buy milk')
        await over(daily, held, onto, INTO)
        await shows(daily, { line: 'todo' })
        const at = await line(daily)
        const y = at.y + at.height / 2
        expect(y).toBeGreaterThanOrEqual(bottom(held.before, 'Find a hotel') - 8)
        expect(y).toBeLessThanOrEqual(top(held.before, 'Pay the rent') + 8)
        await daily.page.keyboard.press('Escape')
        await daily.page.mouse.up()
      }
      await unchanged(daily, on(seed))
      await drop(daily, 'Buy milk', 'Pay the rent', INTO)
      await saved(daily, on([ci, taxes, trip, milk, rent, chores]))
    })

    test('a done todo moves only among the done todos, and never into one', async ({ daily }) => {
      await drop(daily, 'Do the chores', 'Pay the rent', ABOVE)
      await saved(daily, on([milk, ci, taxes, trip, chores, rent]))
      await drop(daily, 'Pay the rent', 'Do the chores', INTO, async () => {
        await expect(daily.page.locator(TINT)).toHaveCount(0)
      })
      await daily.page.waitForTimeout(600)
      expect((await daily.todos())[today]?.find((entry) => entry.id === chores.id)?.steps).toStrictEqual([
        laundry,
        iron
      ])
      await drop(daily, 'Pay the rent', 'Buy milk', ABOVE)
      await daily.page.waitForTimeout(600)
      const list = (await daily.todos())[today] ?? []
      const open = [milk, ci, taxes, trip].map((entry) => list.findIndex((kept) => kept.id === entry.id))
      expect(list.findIndex((entry) => entry.id === rent.id)).toBeGreaterThan(Math.max(...open))
    })

    test('the steps of a done todo move only within it', async ({ daily }) => {
      await drop(daily, 'Do the laundry', 'Buy milk', ABOVE)
      await daily.page.waitForTimeout(600)
      expect((await daily.todos())[today]?.find((entry) => entry.id === chores.id)?.steps).toContainEqual(
        laundry
      )
      await drop(daily, 'Do the laundry', 'Iron the shirts', BELOW)
      await expect
        .poll(async () => (await daily.todos())[today]?.find((entry) => entry.id === chores.id)?.steps)
        .toStrictEqual([iron, laundry])
    })
  })

  test.describe('what follows a drop', () => {
    test.describe('into a todo just checked', () => {
      test.use({ seed: on([milk, taxes, plants]) })

      test('an open row dropped into a todo that is done, before it settles, opens it again', async ({
        daily
      }) => {
        await daily.box('Do the taxes').click()
        // Within the settling delay, so the done todo is still where it was.
        await drop(daily, 'Buy milk', 'Do the taxes', INTO, async () => {
          await shows(daily, { into: 'Do the taxes' })
        })
        await saved(daily, on([under(taxes, [milk]), plants]))
        await expect(daily.ring).toHaveAttribute('aria-valuetext', '0 of 2 resolved')
      })
    })

    test.describe('out of a todo’s only step', () => {
      test.use({ seed: on([under(trip, [flights]), milk]) })

      test('the todo that loses its last step loses its toggle, and the ring counts one more', async ({
        daily
      }) => {
        await expect(daily.ring).toHaveAttribute('aria-valuetext', '0 of 2 resolved')
        await drop(daily, 'Book the flights', 'Buy milk', ABOVE)
        const { steps: _gone, ...bare } = trip
        await saved(daily, on([bare, flights, milk]))
        await expect(daily.chevron('Plan the trip')).toHaveCount(0)
        await expect(daily.ring).toHaveAttribute('aria-valuetext', '0 of 3 resolved')
      })
    })
  })

  test.describe('at the edge of a zone, in a fractional layout', () => {
    test.use({ seed: on([milk, taxes, plants]) })

    test('the zones change sides at their edges, at 125% zoom', async ({ daily }) => {
      await daily.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1.25)
      })
      await expect.poll(() => daily.page.evaluate(() => window.devicePixelRatio)).toBe(1.25)
      await daily.page.waitForTimeout(300)

      const held = await pickUp(daily, 'Buy milk')
      const off = 0.06
      await over(daily, held, 'Do the taxes', EDGE - off)
      await shows(daily, { line: 'todo', near: top(held.before, 'Do the taxes') })
      await over(daily, held, 'Do the taxes', EDGE + off)
      await shows(daily, { into: 'Do the taxes' })
      await over(daily, held, 'Do the taxes', 1 - EDGE - off)
      await shows(daily, { into: 'Do the taxes' })
      await over(daily, held, 'Do the taxes', 1 - EDGE + off)
      await shows(daily, { line: 'todo', near: bottom(held.before, 'Do the taxes') })
      await daily.page.mouse.up()
      await saved(daily, on([taxes, milk, plants]))
    })
  })

  test.describe('in the smallest window', () => {
    const many = Array.from({ length: 14 }, (_, i) => todo(`Todo ${String(i + 1).padStart(2, '0')}`))
    const [first, ...rest] = many
    test.use({ seed: on(many) })

    test('a row held past the list’s bottom or top edge scrolls it; resting inside, nothing moves', async ({
      daily
    }) => {
      if (first === undefined) throw new Error('No todos')
      await daily.app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(640, 420)
      })
      await expect
        .poll(() => daily.page.evaluate(() => [window.innerWidth, window.innerHeight]))
        .toEqual([640, 420])
      await daily.page.waitForTimeout(300)
      const scrolled = () =>
        daily.page.evaluate(() => {
          const list = document.querySelector('li[data-todo]:not([data-step])')?.parentElement
          return list === null || list === undefined ? -1 : list.scrollTop
        })
      expect(await scrolled()).toBe(0)

      // Resting on the last row shown keeps it aimed: the list does not scroll under the pointer.
      const down = await pickUp(daily, 'Todo 01')
      const { list } = down.before
      const x = list.x + list.width * 0.3
      await glide(daily, down, { x, y: list.y + list.height - 8 })
      await daily.page.waitForTimeout(600)
      expect(await scrolled()).toBe(0)
      await shows(daily, { line: 'todo' })
      await glide(daily, down, { x, y: list.y + list.height + 40 })
      await expect(daily.page.locator(LINE)).toHaveCount(0)
      await expect(daily.page.locator(TINT)).toHaveCount(0)
      await expect(daily.row('Todo 14')).toBeInViewport({ ratio: 1, timeout: 10_000 })
      await expect.poll(scrolled).toBeGreaterThan(0)
      await daily.page.waitForTimeout(300)
      await steady(daily, down.before, 'scrolled down while held')
      // Back in, it aims at the rows as they are now.
      const atBottom = await measure(daily)
      await glide(daily, down, aim(atBottom, 'Todo 14', ABOVE))
      await shows(daily, { line: 'todo', near: top(atBottom, 'Todo 14') })
      await daily.page.mouse.up()
      const once = [...rest.slice(0, 12), first, ...rest.slice(12)]
      await saved(daily, on(once))

      const up = await pickUp(daily, 'Todo 13')
      const scrolledDown = await scrolled()
      await glide(daily, up, { x, y: list.y + 8 })
      await daily.page.waitForTimeout(600)
      expect(await scrolled()).toBe(scrolledDown)
      await glide(daily, up, { x, y: list.y - 40 })
      await expect(daily.page.locator(LINE)).toHaveCount(0)
      await expect.poll(scrolled, { timeout: 10_000 }).toBe(0)
      await daily.page.waitForTimeout(300)
      await steady(daily, up.before, 'scrolled up while held')
      const atTop = await measure(daily)
      await glide(daily, up, aim(atTop, 'Todo 02', ABOVE))
      await shows(daily, { line: 'todo', near: top(atTop, 'Todo 02') })
      await daily.page.mouse.up()
      const thirteen = once.find((entry) => entry.text === 'Todo 13')
      if (thirteen === undefined) throw new Error('No Todo 13')
      await saved(daily, on([thirteen, ...once.filter((entry) => entry !== thirteen)]))
    })
  })

  test.describe('by keyboard', () => {
    const seed = [milk, ci, taxes, folded(trip), plants, house, rent]
    test.use({ seed: on(seed) })

    const focused = (daily: Daily) =>
      daily.page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName
      )

    test('Space picks a row up with the line at its own place, nothing moves, and Escape puts it back', async ({
      daily
    }) => {
      const before = await measure(daily)
      await hold(daily, 'Do the taxes')
      await daily.page.keyboard.press('Space')
      await daily.page.waitForTimeout(150)
      await shows(daily, { line: 'todo' })
      const at = await line(daily)
      expect(at.y + at.height / 2).toBeGreaterThanOrEqual(top(before, 'Do the taxes') - 8)
      expect(at.y + at.height / 2).toBeLessThanOrEqual(bottom(before, 'Do the taxes') + 8)
      await steady(daily, before, 'picked up from the keyboard')
      await daily.page.keyboard.press('Escape')
      await unchanged(daily, on(seed))
      await expect(daily.page.locator(LINE)).toHaveCount(0)
    })

    test('a todo’s arrows walk the gaps between todos only, so Space ↑ Space still moves it up by one', async ({
      daily
    }) => {
      const before = await measure(daily)
      await hold(daily, 'Do the taxes')
      await daily.page.keyboard.press('Space')
      await daily.page.waitForTimeout(150)
      for (const above of ['Set up CI', 'Buy milk']) {
        await daily.page.keyboard.press('ArrowUp')
        await daily.page.waitForTimeout(350)
        await shows(daily, { line: 'todo', near: top(before, above) })
      }
      await steady(daily, before, 'walked up from the keyboard')
      await daily.page.keyboard.press('Escape')
      await unchanged(daily, on(seed))

      await carry(daily, 'Do the taxes', ['ArrowUp'])
      await saved(daily, on([milk, taxes, ci, folded(trip), plants, house, rent]))
      // Down past an unfolded todo with steps, never among them; and never among the done ones.
      await carry(daily, 'Water the plants', ['ArrowDown', 'ArrowDown'])
      await saved(daily, on([milk, taxes, ci, folded(trip), house, plants, rent]))
    })

    test('a step’s arrows walk the gaps between steps, into the next unfolded todo, past a folded one', async ({
      daily
    }) => {
      const before = await measure(daily)
      await hold(daily, 'Fix the lint errors')
      await daily.page.keyboard.press('Space')
      await daily.page.waitForTimeout(150)
      await daily.page.keyboard.press('ArrowDown')
      await daily.page.waitForTimeout(350)
      await shows(daily, { line: 'step', of: 'Set up CI', near: bottom(before, 'Cache the dependencies') })
      await daily.page.keyboard.press('ArrowDown')
      await daily.page.waitForTimeout(350)
      await shows(daily, { line: 'step', of: 'Clean the house', near: top(before, 'Dust the shelves') })
      await daily.page.keyboard.press('Space')
      await saved(
        daily,
        on([
          milk,
          under(ci, [workflow, cache]),
          taxes,
          folded(trip),
          plants,
          under(house, [lint, dust, mop]),
          rent
        ])
      )

      await carry(daily, 'Fix the lint errors', ['ArrowUp'])
      await saved(
        daily,
        on([milk, under(ci, [workflow, cache, lint]), taxes, folded(trip), plants, house, rent])
      )
    })

    test('after a last step, ← and → choose between a step at the end and a todo after it', async ({
      daily
    }) => {
      await carry(daily, 'Fix the lint errors', ['ArrowDown'], async () => {
        await shows(daily, { line: 'step', of: 'Set up CI' })
        await daily.page.keyboard.press('ArrowLeft')
        await daily.page.waitForTimeout(350)
        await shows(daily, { line: 'todo' })
        // → from a todo gap is always into the todo above: here, the same place as a step at its end.
        await daily.page.keyboard.press('ArrowRight')
        await daily.page.waitForTimeout(350)
        await shows(daily, { into: 'Set up CI' })
        await daily.page.keyboard.press('ArrowLeft')
        await daily.page.waitForTimeout(350)
        await shows(daily, { line: 'todo' })
      })
      await saved(
        daily,
        on([milk, under(ci, [workflow, cache]), lint, taxes, folded(trip), plants, house, rent])
      )
    })

    test('→ puts a todo into the todo above, which unfolds; ← puts a step out just after its todo', async ({
      daily
    }) => {
      await carry(daily, 'Do the taxes', ['ArrowRight'], async () => {
        await shows(daily, { into: 'Set up CI' })
      })
      await saved(
        daily,
        on([milk, under(ci, [workflow, lint, cache, taxes]), folded(trip), plants, house, rent])
      )

      await carry(daily, 'Water the plants', ['ArrowRight'])
      await saved(
        daily,
        on([
          milk,
          under(ci, [workflow, lint, cache, taxes]),
          under(trip, [flights, hotel, plants]),
          house,
          rent
        ])
      )

      await carry(daily, 'Add the workflow file', ['ArrowLeft'])
      await saved(
        daily,
        on([
          milk,
          under(ci, [lint, cache, taxes]),
          workflow,
          under(trip, [flights, hotel, plants]),
          house,
          rent
        ])
      )
    })

    test('→ on a todo with steps of its own, or on the first todo, is refused in words, and nothing is saved', async ({
      daily
    }) => {
      const heard = await listen(daily)
      await hold(daily, 'Clean the house')
      await daily.page.keyboard.press('Space')
      await daily.page.waitForTimeout(150)
      await daily.page.keyboard.press('ArrowRight')
      await daily.page.waitForTimeout(350)
      await expect(daily.page.locator(TINT)).toHaveCount(0)
      expect(await heard()).toContainEqual(
        expect.stringMatching(begins("Can't be a step: it has steps of its own."))
      )
      await daily.page.keyboard.press('Space')
      await unchanged(daily, on(seed))

      await carry(daily, 'Buy milk', ['ArrowRight'], async () => {
        await expect(daily.page.locator(TINT)).toHaveCount(0)
      })
      expect(await heard()).toContain("Can't be a step: no todo above.")
      await unchanged(daily, on(seed))
    })

    test('a keyboard drop leaves the focus on the text of the row it moved', async ({ daily }) => {
      await carry(daily, 'Do the taxes', ['ArrowUp'])
      await expect.poll(() => focused(daily)).toBe('Edit Do the taxes')
      await carry(daily, 'Water the plants', ['ArrowRight'])
      await expect.poll(() => focused(daily)).toBe('Edit Water the plants')
      // Held for a while, as a keyboard user would before the next key.
      await daily.page.waitForTimeout(1000)
      expect(await focused(daily)).toBe('Edit Water the plants')
      await carry(daily, 'Water the plants', ['ArrowLeft'])
      await expect.poll(() => focused(daily)).toBe('Edit Water the plants')
    })
  })
})

test.describe('dragging a row', () => {
  test.describe('the deck', () => {
    test.use({ seed: on([milk, taxes]) })

    test('a sideways swipe while a row is held leaves the day in front; at rest it flips to another day', async ({
      daily
    }) => {
      const swipe = async () => {
        for (let i = 0; i < 12; i++) {
          await daily.page.mouse.wheel(40, 0)
          await daily.page.waitForTimeout(16)
        }
        await daily.page.waitForTimeout(700)
      }
      const box = await daily.editButton('Do the taxes').locator('span').first().boundingBox()
      if (box === null) throw new Error('The words of Do the taxes are not shown')
      await daily.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await daily.page.mouse.down()
      await daily.page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 8, { steps: 4 })
      await expect(daily.page.locator('section[data-sorting]')).toHaveCount(1)

      await swipe()

      await expect(daily.heading('Today')).toBeVisible()
      await daily.page.mouse.up()
      await expect(daily.page.locator('[data-sorting]')).toHaveCount(0)
      await unchanged(daily, on([milk, taxes]))

      await swipe()

      await expect(daily.heading('Today')).toBeHidden()
    })
  })
})

test.describe('what lifts a row', () => {
  test.use({ seed: on([milk, ci, folded(trip), taxes]) })

  const lifted = (daily: Daily) => daily.page.locator('li[data-dragging]')

  /**
   * Presses at a point, moves `by` px down from it, and says whether a row was lifted. A lifted row is
   * let go with Escape first, so nothing is dropped; one that was not is let go where the pointer is.
   */
  async function press(daily: Daily, at: { x: number; y: number }, by: number): Promise<boolean> {
    await daily.page.mouse.move(at.x, at.y)
    await daily.page.mouse.down()
    await daily.page.mouse.move(at.x, at.y + by, { steps: 6 })
    await daily.page.waitForTimeout(150)
    const up = (await lifted(daily).count()) > 0
    if (up) await daily.page.keyboard.press('Escape')
    await daily.page.mouse.up()
    await expect(lifted(daily)).toHaveCount(0)
    await daily.page.waitForTimeout(300)
    return up
  }
  const middle = async (locator: ReturnType<Daily['row']>) => {
    const box = await locator.boundingBox()
    if (box === null) throw new Error(`${locator.toString()} is not shown`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  test('from its words or its empty start, past 5px; a plain click on the words edits it', async ({
    daily
  }) => {
    const words = await daily.editButton('Do the taxes').locator('span').first().boundingBox()
    if (words === null) throw new Error('The words of Do the taxes are not shown')
    const start = { x: words.x + 8, y: words.y + words.height / 2 }
    expect(await press(daily, start, 3), '3px on the words').toBe(false)
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveValue('Do the taxes')
    await daily.page.keyboard.press('Escape')
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)
    expect(await press(daily, start, 10), '10px on the words').toBe(true)
    // A plain todo's start, where a todo with steps has its fold, is an empty part of the row.
    const line = await daily.line('Do the taxes').boundingBox()
    const box = await daily.box('Do the taxes').boundingBox()
    if (line === null || box === null) throw new Error('Do the taxes is not shown')
    expect(
      await press(daily, { x: (line.x + box.x) / 2, y: box.y + box.height / 2 }, 10),
      'its empty start'
    ).toBe(true)
    const step = await daily.editButton('Fix the lint errors').locator('span').first().boundingBox()
    if (step === null) throw new Error('The words of Fix the lint errors are not shown')
    expect(await press(daily, { x: step.x + 8, y: step.y + step.height / 2 }, 10), 'a step’s words').toBe(
      true
    )
    await unchanged(daily, on([milk, ci, folded(trip), taxes]))

    await daily.page.mouse.click(start.x, start.y)
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveValue('Do the taxes')
  })

  test('never from its box, its fold, the buttons at its end or the add under its steps', async ({
    daily
  }) => {
    const parts: [string, ReturnType<Daily['row']>][] = [
      ['the box', daily.box('Do the taxes')],
      ['a step’s box', daily.box('Fix the lint errors')],
      ['the fold', daily.chevron('Set up CI')],
      ['the folded fold', daily.chevron('Plan the trip')],
      ['Move', daily.button('Do the taxes', 'Move Do the taxes to tomorrow')],
      ['Add a step', daily.button('Do the taxes', 'Add a step to Do the taxes')],
      ['the bin', daily.button('Do the taxes', 'Delete Do the taxes')],
      ['a step’s bin', daily.button('Fix the lint errors', 'Delete Fix the lint errors')],
      ['the add under the steps', daily.more('Set up CI')]
    ]
    for (const [name, part] of parts) {
      // Pointed at first, as a hand would, so what shows on hover is there. The pointer moves on past the
      // part's 28px, so letting go is not a click on it.
      await part.hover()
      expect(await press(daily, await middle(part), 30), name).toBe(false)
    }
    await unchanged(daily, on([milk, ci, folded(trip), taxes]))
  })

  test('from the keyboard Space on the text lifts it and Enter edits it; ← and → change the day until it is lifted', async ({
    daily
  }) => {
    const text = daily.editButton('Do the taxes')
    await text.focus()
    await daily.page.keyboard.press('Enter')
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveValue('Do the taxes')
    await daily.page.keyboard.press('Escape')
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)

    await text.focus()
    await daily.page.keyboard.press('ArrowRight')
    await expect(daily.heading('Tomorrow')).toBeVisible()
    await daily.page.keyboard.press('ArrowLeft')
    await expect(daily.heading('Today')).toBeVisible()

    await hold(daily, 'Do the taxes')
    await daily.page.keyboard.press('Space')
    await expect(lifted(daily)).toHaveCount(1)
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)
    await daily.page.keyboard.press('ArrowRight')
    await daily.page.waitForTimeout(350)
    await expect(daily.heading('Today')).toBeVisible()
    await expect(daily.heading('Tomorrow')).toBeHidden()
    await daily.page.keyboard.press('Escape')
    await expect(lifted(daily)).toHaveCount(0)
    await unchanged(daily, on([milk, ci, folded(trip), taxes]))

    await carry(daily, 'Do the taxes', ['ArrowUp'])
    await saved(daily, on([milk, ci, taxes, folded(trip)]))
    await expect
      .poll(() => daily.page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
      .toBe('Edit Do the taxes')
    // Enter drops it too, and opens no editor.
    await hold(daily, 'Do the taxes')
    await daily.page.keyboard.press('Space')
    await expect(lifted(daily)).toHaveCount(1)
    await daily.page.keyboard.press('ArrowDown')
    await daily.page.waitForTimeout(350)
    await daily.page.keyboard.press('Enter')
    await saved(daily, on([milk, ci, folded(trip), taxes]))
    await expect(daily.page.getByRole('textbox', { name: 'Edit todo' })).toHaveCount(0)
    await expect
      .poll(() => daily.page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
      .toBe('Edit Do the taxes')
  })

  test('the text says how it is moved and stays a plain button, and no row has a grip', async ({ daily }) => {
    await expect(daily.page.locator('[aria-label^="Reorder "]')).toHaveCount(0)
    await expect(daily.page.locator('[data-todo-handle]:not([aria-label^="Edit "])')).toHaveCount(0)
    const plain = async () => {
      for (const text of ['Buy milk', 'Set up CI', 'Fix the lint errors', 'Plan the trip']) {
        await expect(daily.editButton(text), text).toHaveAccessibleDescription(
          'Press Enter to edit, Space to pick up. Up and Down arrows move it. Right arrow makes it a step of ' +
            'the todo above, Left arrow a todo again. Space drops it, Escape cancels.'
        )
        for (const attribute of ['aria-roledescription', 'aria-pressed', 'aria-grabbed', 'aria-disabled'])
          await expect(daily.editButton(text), `${text}: ${attribute}`).not.toHaveAttribute(attribute)
      }
    }
    await plain()
    // While a step is being written too.
    await daily.page.getByRole('button', { name: 'Edit Buy milk', exact: true }).hover()
    await daily.button('Buy milk', 'Add a step to Buy milk').click()
    await expect(daily.page.getByRole('textbox', { name: 'New step' })).toBeFocused()
    await plain()
  })
})
