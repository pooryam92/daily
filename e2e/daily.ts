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

  private editButton(text: string): Locator {
    return this.page.getByRole('button', { name: `Edit ${text}`, exact: true })
  }

  /**
   * The toggle that folds and unfolds a todo's steps. It lies over the count, so a click on the count
   * lands on it. The one place that knows its name.
   */
  chevron(text: string): Locator {
    return this.row(text).getByRole('button', { name: `Steps of ${text}`, exact: true })
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

  /** What is on disk right now; saves are asynchronous, so poll it. */
  settings(): Promise<Settings> {
    return this.read<Settings>('settings.json')
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
