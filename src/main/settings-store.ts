import fs from 'node:fs'
import { parseSettings } from '../shared/settings'
import type { Settings } from '../shared/settings'

/** Persists the settings as a JSON file. */
export class SettingsStore {
  readonly #file: string
  #settings: Settings

  /**
   * Reads the file synchronously, on purpose: the theme has to be known before the window is
   * created, or the app would start in the wrong colours. An unreadable file means defaults.
   */
  constructor(file: string) {
    this.#file = file
    let content: unknown = null
    try {
      content = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      // No file yet, or not JSON: parseSettings turns null into the defaults.
    }
    this.#settings = parseSettings(content)
  }

  get settings(): Settings {
    return this.#settings
  }

  async update(changes: Partial<Settings>): Promise<void> {
    this.#settings = { ...this.#settings, ...changes }
    // Write to a temp file first so a crash mid-write can't corrupt the settings.
    const tmp = `${this.#file}.tmp`
    await fs.promises.writeFile(tmp, JSON.stringify(this.#settings, null, 2))
    await fs.promises.rename(tmp, this.#file)
  }
}
