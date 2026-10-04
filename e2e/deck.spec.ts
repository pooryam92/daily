import { expect, test } from './daily'
import type { Daily } from './daily'

const card = (daily: Daily, offset: number) => daily.page.locator(`section[data-offset="${String(offset)}"]`)
const front = (daily: Daily) => card(daily, 0)

async function boxOf(daily: Daily, selector: string) {
  return daily.page.evaluate((query) => {
    const at = document.querySelector(query)?.getBoundingClientRect()
    return at === undefined ? null : { left: at.left, right: at.right, top: at.top, bottom: at.bottom }
  }, selector)
}

for (const [width, height] of [
  [640, 420],
  [1268, 656]
] as const) {
  test(`at ${String(width)}×${String(height)} each arrow lies on its neighbour’s strip, clear of the front card, and moves one day`, async ({
    daily
  }) => {
    await daily.app.evaluate(
      ({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height)
      },
      { width, height }
    )
    await expect
      .poll(() => daily.page.evaluate(() => [window.innerWidth, window.innerHeight]))
      .toEqual([width, height])

    for (const [direction, offset] of [
      ['previous', -1],
      ['next', 1]
    ] as const) {
      const measure = async () => ({
        arrow: await boxOf(daily, `button[data-direction="${direction}"]`),
        front: await boxOf(daily, 'section[data-offset="0"]'),
        neighbour: await boxOf(daily, `section[data-offset="${String(offset)}"]`)
      })
      // Settled: two equal measures 100ms apart.
      let at = await measure()
      await expect
        .poll(async () => {
          const before = JSON.stringify(at)
          await daily.page.waitForTimeout(100)
          at = await measure()
          return JSON.stringify(at) === before
        })
        .toBe(true)
      const { arrow, front: main, neighbour } = at
      if (arrow === null || main === null || neighbour === null)
        throw new Error(`Missing: ${JSON.stringify(at)}`)
      // The part of the neighbour that shows: from the window's edge or its own, to the front card.
      const strip =
        direction === 'previous'
          ? { left: Math.max(0, neighbour.left), right: Math.min(neighbour.right, main.left) }
          : { left: Math.max(neighbour.left, main.right), right: Math.min(width, neighbour.right) }
      const where = `${direction}: ${JSON.stringify({ ...at, strip })}`
      expect(strip.right - strip.left, where).toBeGreaterThan(0)
      expect(arrow.left, where).toBeGreaterThanOrEqual(strip.left - 0.5)
      expect(arrow.right, where).toBeLessThanOrEqual(strip.right + 0.5)
      expect(arrow.top, where).toBeGreaterThanOrEqual(neighbour.top - 0.5)
      expect(arrow.bottom, where).toBeLessThanOrEqual(neighbour.bottom + 0.5)
      if (direction === 'previous') expect(arrow.right, where).toBeLessThanOrEqual(main.left + 0.5)
      else expect(arrow.left, where).toBeGreaterThanOrEqual(main.right - 0.5)
    }

    await expect(front(daily).getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
    await daily.page.getByRole('button', { name: 'Previous day' }).click()
    await expect(front(daily).getByRole('heading', { name: 'Yesterday', exact: true })).toBeVisible()
    await expect(card(daily, 1)).toHaveAttribute('data-today', 'true')
    await daily.page.getByRole('button', { name: 'Next day' }).click()
    await expect(front(daily)).toHaveAttribute('data-today', 'true')
    await daily.page.getByRole('button', { name: 'Next day' }).click()
    await expect(front(daily).getByRole('heading', { name: 'Tomorrow', exact: true })).toBeVisible()
    await expect(card(daily, -1)).toHaveAttribute('data-today', 'true')
  })
}
