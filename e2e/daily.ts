import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test as base } from '@playwright/test'
import type { ElectronApplication, Locator, Page } from '@playwright/test'
import { addDays, toDayKey } from '../src/domain/dates'
import type { Settings } from '../src/domain/settings'
import { STORE_VERSION } from '../src/domain/store'
import type { StoreData } from '../src/domain/store'
import type { DayKey, DaysMap, Todo, TodoStatus } from '../src/domain/todo'

const ROOT = path.resolve(__dirname, '..')
// ELECTRON_RUN_AS_NODE is set by VS Code for its terminals; with it Electron starts as plain Node
// and never opens a window. On a Wayland desktop Electron draws there, past the X display that
// `xvfb-run` provides, so the Wayland variables are dropped and the windows stay off screen.
const dropped = new Set(['ELECTRON_RUN_AS_NODE', 'WAYLAND_DISPLAY', 'XDG_SESSION_TYPE'])
const env: Record<string, string> = {}
for (const [key, value] of Object.entries(process.env)) {
  if (!dropped.has(key) && value !== undefined) env[key] = value
}

export const today: DayKey = toDayKey(new Date())
export const day = (offset: number): DayKey => addDays(today, offset)
export const todo = (text: string, status: TodoStatus = 'open', steps?: readonly Todo[]): Todo => ({
  id: randomUUID(),
  text,
  status,
  ...(steps === undefined ? {} : { steps })
})

export const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${locator.toString()} is not shown`)
  return box
}

/** How opaque the most opaque part of `locator` looks, counting opacity on every element up from it. */
export const seen = (locator: Locator) =>
  locator.evaluate((element) => {
    const shown = (at: Element) => {
      let value = 1
      for (let up: Element | null = at; up !== null; up = up.parentElement) {
        const style = getComputedStyle(up)
        if (style.visibility === 'hidden' || style.display === 'none') return 0
        value *= Number(style.opacity)
      }
      return value
    }
    const leaves = [element, ...element.querySelectorAll('*')].filter((at) => at.childElementCount === 0)
    return Math.max(...leaves.map(shown))
  })
export const hidden = (locator: Locator, message?: string) =>
  expect.poll(() => seen(locator), { message }).toBeLessThan(0.05)
export const showing = (locator: Locator, message?: string) =>
  expect.poll(() => seen(locator), { message }).toBeGreaterThan(0.95)

/** The built app, running from a data folder of its own that a test may seed, read and reopen. */
export class Daily {
  page!: Page
  private running: ElectronApplication | undefined

  constructor(readonly userData: string) {}

  get app(): ElectronApplication {
    if (this.running === undefined) throw new Error('Daily is not running')
    return this.running
  }

  async launch(): Promise<void> {
    this.running = await electron.launch({
      args: [
        ROOT,
        `--user-data-dir=${this.userData}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : [])
      ],
      cwd: ROOT,
      env
    })
    this.page = await this.app.firstWindow()
    // Under xvfb X sends the page pointer events from its cursor at the screen's centre, even mid-drag,
    // so the window goes below and right of the cursor, never under it, whatever its size.
    await this.app.evaluate(({ BrowserWindow, screen }) => {
      const cursor = screen.getCursorScreenPoint()
      BrowserWindow.getAllWindows()[0]?.setPosition(cursor.x + 1, cursor.y + 1)
    })
    await this.input.waitFor()
  }

  /** Closes the app if it is running; safe after a launch that failed half way. */
  async close(): Promise<void> {
    const app = this.running
    this.running = undefined
    await app?.close()
  }

  async restart(): Promise<void> {
    await this.close()
    await this.launch()
  }

  get input(): Locator {
    return this.page.getByLabel('Add a todo')
  }

  async add(text: string): Promise<void> {
    await this.input.fill(text)
    await this.input.press('Enter')
  }

  /** A todo's row on the card in front, with its steps under it; steps themselves are `step`. */
  row(text: string): Locator {
    return this.page.locator('li[data-todo]:not([data-step])').filter({ has: this.editButton(text) })
  }

  /** A step's row, under its todo's on the card in front. */
  step(text: string): Locator {
    return this.page.locator('li[data-step]').filter({ has: this.editButton(text) })
  }

  /**
   * The box of a todo or a step itself. A todo's row holds its steps' boxes too, so this is the box
   * on the line that holds the text, not on the lines under it.
   */
  box(text: string): Locator {
    return this.page
      .locator('[data-todo] > div')
      .filter({ has: this.editButton(text) })
      .getByRole('checkbox', { name: 'Done' })
  }

  /** A row's text, which edits it, and is also what lifts it: by the pointer after 5px, by Space from the keyboard. */
  editButton(text: string): Locator {
    return this.page.getByRole('button', { name: `Edit ${text}`, exact: true })
  }

  /**
   * The toggle that folds and unfolds a todo's steps: a chevron in the slot at the row's start, before
   * the box. The one place that knows its name.
   */
  chevron(text: string): Locator {
    const name = new RegExp(`^(Show|Hide) steps of ${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
    return this.row(text).getByRole('button', { name })
  }

  /** The line that holds `text`, a todo's or a step's, without the lines of its steps under it. */
  line(text: string): Locator {
    return this.page.locator('[data-todo] > div').filter({ has: this.editButton(text) })
  }

  /** Points at the words of `text`'s line, so the buttons at its end show. */
  async point(text: string): Promise<void> {
    const words = await boxOf(this.line(text).locator('[data-todo-text]').first())
    await this.page.mouse.move(words.x + 8, words.y + 10)
  }

  /**
   * One of the buttons at the end of the line that holds `text`, by its full name: "Move to tomorrow:
   * <text>" (or "to today"), "Delete <text>" or "Add a step to <text>". They show on hover or focus.
   */
  button(text: string, name: string): Locator {
    return this.line(text).getByRole('button', { name, exact: true })
  }

  /**
   * The names of the buttons that act on the line that holds `text`, in the order they stand: not its
   * text or its steps' fold, which are not actions.
   */
  async actions(text: string): Promise<string[]> {
    const names = await this.line(text)
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''))
    return names.filter((name) => !/^(Edit|Show steps of|Hide steps of) /.test(name))
  }

  /**
   * The button "Add a step to <text>" that fills the space under an unfolded todo's last step; never the
   * one on the todo's line, which shares its name. Found shown or not.
   */
  more(text: string): Locator {
    return this.row(text).locator(':scope > :not(div)').locator(`button[aria-label="Add a step to ${text}"]`)
  }

  /**
   * The tip that names a row's button, shown on keyboard focus at once and after a moment's hover. It
   * is drawn outside the card, so it is found on the page. One that is fading out is not it.
   */
  get tip(): Locator {
    return this.page.getByRole('tooltip').and(this.page.locator(':not([data-ending-style])'))
  }

  /**
   * The open menu, found on the page as it is drawn outside the card. One that has just closed fades
   * out for a moment with data-closed; it is not the open one.
   */
  get menu(): Locator {
    return this.page.getByRole('menu').and(this.page.locator(':not([data-closed])'))
  }

  /** An item of the open menu, by its full name, such as "Delete Buy milk". */
  menuItem(name: string): Locator {
    return this.menu.getByRole('menuitem', { name, exact: true })
  }

  /** Opens the menu of the line that holds `text` with a right-click on its words. */
  async openMenu(text: string): Promise<void> {
    await this.editButton(text).click({ button: 'right' })
    await expect(this.menu).toBeVisible()
  }

  /** Points at the line that holds `text` and clicks its button `item`, by its full name. */
  async act(text: string, item: string): Promise<void> {
    await this.line(text).hover()
    await this.button(text, item).click()
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true })
  }

  async openSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings' }).click()
  }

  /** What is on disk right now; saves are asynchronous, so poll it. */
  async todos(): Promise<DaysMap> {
    return (await this.read<StoreData>('todos.json')).days
  }

  /** What is on disk right now, if it is written yet; saves are asynchronous, so poll it. */
  async settings(): Promise<Settings | undefined> {
    return this.read<Settings>('settings.json').catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    })
  }

  /** A file in the data folder as it is written, for its exact shape. */
  file(name: string): Promise<string> {
    return readFile(path.join(this.userData, name), 'utf8')
  }

  /** The day's progress ring, which says how many of its todos are resolved. */
  get ring(): Locator {
    return this.page.getByRole('progressbar', { name: 'Day progress' })
  }

  private async read<T>(file: string): Promise<T> {
    return JSON.parse(await this.file(file)) as T
  }
}

interface Fixtures {
  readonly seed: DaysMap | null
  readonly daily: Daily
}

export const test = base.extend<Fixtures>({
  seed: [null, { option: true }],
  daily: async ({ seed }, use, testInfo) => {
    const userData = await mkdtemp(path.join(tmpdir(), 'daily-e2e-'))
    if (seed !== null) {
      const data: StoreData = { version: STORE_VERSION, days: seed }
      await writeFile(path.join(userData, 'todos.json'), JSON.stringify(data))
    }
    const daily = new Daily(userData)
    try {
      await daily.launch()
      await use(daily)
      if (testInfo.status !== testInfo.expectedStatus) {
        const body = await daily.page.screenshot().catch(() => null)
        if (body !== null) await testInfo.attach('window', { body, contentType: 'image/png' })
      }
    } finally {
      await daily.close().catch(() => undefined)
      await rm(userData, { recursive: true, force: true })
    }
  }
})

export { expect }
