import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppUpdate } from '../../ports'

/** The app stays open for days, so a check at launch alone would miss most releases. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

const DOWNLOAD_PAGE = 'https://github.com/pooryam92/daily/releases/latest'

/** electron-builder writes this file into a `.deb` or `.rpm` build. */
const isLinuxPackage = (): boolean =>
  process.platform === 'linux' && existsSync(join(process.resourcesPath, 'package-type'))

/** macOS lets only an app with an Apple developer signature replace itself. */
const canReplaceItself = (): boolean =>
  process.platform === 'win32' || process.env.APPIMAGE !== undefined || isLinuxPackage()

/**
 * Looks for a newer release on the feed in electron-builder.yml. It reports an update only once the
 * user can act on it, and never a failure: being offline is normal.
 */
export class Updater {
  readonly #onFound: (update: AppUpdate) => void
  #found: AppUpdate | null = null

  constructor(onFound: (update: AppUpdate) => void) {
    this.#onFound = onFound
  }

  /** For a window that opens after the update was found. */
  get found(): AppUpdate | null {
    return this.#found
  }

  start(): void {
    if (!app.isPackaged) return

    const selfReplacing = canReplaceItself()
    autoUpdater.autoDownload = selfReplacing
    // A package asks for the password; that dialog should answer a click, not a quit.
    autoUpdater.autoInstallOnAppQuit = !isLinuxPackage()
    // Without a listener, an 'error' event throws. The updater already logs it.
    autoUpdater.on('error', () => undefined)

    if (selfReplacing) {
      autoUpdater.on('update-downloaded', ({ version }) => {
        this.#report({ version, install: 'restart' })
      })
    } else {
      autoUpdater.on('update-available', ({ version }) => {
        this.#report({ version, install: 'manual' })
      })
    }

    const check = (): void => {
      autoUpdater.checkForUpdates().catch(() => undefined)
    }
    check()
    setInterval(check, CHECK_INTERVAL_MS)
  }

  restart(): void {
    if (this.#found?.install !== 'restart') return
    // A new AppImage or Windows install starts before this one is gone, and would give up at the lock.
    if (!isLinuxPackage()) app.releaseSingleInstanceLock()
    const silent = true
    const runAfterInstall = true
    autoUpdater.quitAndInstall(silent, runAfterInstall)
  }

  async openDownloadPage(): Promise<void> {
    await shell.openExternal(DOWNLOAD_PAGE)
  }

  #report(update: AppUpdate): void {
    this.#found = update
    this.#onFound(update)
  }
}
