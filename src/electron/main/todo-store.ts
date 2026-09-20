import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { EMPTY_STORE } from '../../domain/store'
import type { StoreData } from '../../domain/store'
import { parseStoreData } from '../../domain/store-schema'

const hasCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code

const isNotFound = (error: unknown): boolean => hasCode(error, 'ENOENT')

const BACKUP_PATTERN = /^todos\.before-v.+\.json$/
const BACKUPS_KEPT = 5

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

  /**
   * Copies the file to `todos.before-v<version>.json`, once per app version. The first start of a
   * new version keeps the todos as the previous one left them, in case the update mishandles them.
   */
  async backupBefore(version: string): Promise<void> {
    const dir = path.dirname(this.#file)
    try {
      // COPYFILE_EXCL makes "once" atomic: a backup that exists is never overwritten.
      await fs.copyFile(this.#file, path.join(dir, `todos.before-v${version}.json`), constants.COPYFILE_EXCL)
    } catch (error) {
      // No todos yet, or this version already made its backup.
      if (isNotFound(error) || hasCode(error, 'EEXIST')) return
      throw error
    }
    await this.#pruneBackups(dir)
  }

  async #pruneBackups(dir: string): Promise<void> {
    const names = (await fs.readdir(dir)).filter((name) => BACKUP_PATTERN.test(name))
    const backups = await Promise.all(
      names.map(async (name) => {
        const file = path.join(dir, name)
        return { file, modified: (await fs.stat(file)).mtimeMs }
      })
    )
    const stale = backups.sort((a, b) => b.modified - a.modified).slice(BACKUPS_KEPT)
    await Promise.all(stale.map(({ file }) => fs.rm(file)))
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
