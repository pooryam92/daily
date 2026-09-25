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
// Set by VS Code for its terminals; with it Electron starts as plain Node and never opens a window.
const env: Record<string, string> = {}
for (const [key, value] of Object.entries(process.env)) {
  if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) env[key] = value
}

export const today: DayKey = toDayKey(new Date())
export const day = (offset: number): DayKey => addDays(today, offset)
export const todo = (text: string, status: TodoStatus = 'open'): Todo => ({ id: randomUUID(), text, status })

/** The built app, running from a data folder of its own that a test may seed, read and reopen. */
export class Daily {
  app!: ElectronApplication
  page!: Page

  constructor(readonly userData: string) {}

  async launch(): Promise<void> {
    this.app = await electron.launch({
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

  async close(): Promise<void> {
    await this.app.close()
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

  /** A todo's row on the card in front. */
  row(text: string): Locator {
    return this.page
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('button', { name: `Edit ${text}`, exact: true }) })
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

  settings(): Promise<Settings> {
    return this.read<Settings>('settings.json')
  }

  private async read<T>(file: string): Promise<T> {
    return JSON.parse(await readFile(path.join(this.userData, file), 'utf8')) as T
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
    await daily.launch()
    await use(daily)
    if (testInfo.status !== testInfo.expectedStatus) {
      const body = await daily.page.screenshot().catch(() => null)
      if (body !== null) await testInfo.attach('window', { body, contentType: 'image/png' })
    }
    await daily.close()
    await rm(userData, { recursive: true, force: true })
  }
})

export { expect }
