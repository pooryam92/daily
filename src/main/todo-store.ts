import fs from 'node:fs/promises'
import { parseStoreData } from '../shared/store-schema'
import { EMPTY_STORE } from '../shared/todo'
import type { StoreData } from '../shared/todo'

const isNotFound = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

/** Persists the todos as a JSON file. */
export class TodoStore {
  readonly #file: string
  #pendingWrite: Promise<void> = Promise.resolve()

  constructor(file: string) {
    this.#file = file
  }

  async load(): Promise<StoreData> {
    let content: string
    try {
      content = await fs.readFile(this.#file, 'utf8')
    } catch (error) {
      if (isNotFound(error)) return EMPTY_STORE
      throw error
    }

    try {
      return parseStoreData(JSON.parse(content))
    } catch (error) {
      // Keep the unreadable file for manual recovery instead of overwriting it on the next save.
      const backup = `${this.#file}.corrupt-${Date.now().toString()}`
      await fs.rename(this.#file, backup)
      console.error(`Could not read ${this.#file}, moved it to ${backup}:`, error)
      return EMPTY_STORE
    }
  }

  /** Saves are queued so that two quick saves can't interleave on disk. */
  save(data: StoreData): Promise<void> {
    const write = this.#pendingWrite.then(() => this.#write(data))
    this.#pendingWrite = write.catch(() => undefined)
    return write
  }

  async #write(data: StoreData): Promise<void> {
    // Write to a temp file first so a crash mid-write can't corrupt the store.
    const tmp = `${this.#file}.tmp`
    await fs.writeFile(tmp, JSON.stringify(data, null, 2))
    await fs.rename(tmp, this.#file)
  }
}
