import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppUpdate } from '../../ports'

/** The app stays open for days, so a check at launch alone would miss most releases. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

const DOWNLOAD_PAGE = 'https://github.com/pooryam92/daily/releases/latest'

/**
 * Only an AppImage and a Windows install can replace themselves. A `.deb` is owned by the package
 * manager, so there the app only says that a newer version exists.
 */
const canReplaceItself = (): boolean => process.platform === 'win32' || process.env.APPIMAGE !== undefined

/**
 * Looks for a newer release on GitHub (the feed is set under `publish` in electron-builder.yml),
 * downloads it in the background and installs it when the app quits. It reports an update only
 * once the user can act on it, and never reports a failure: being offline is normal.
 */
export class Updater {
  readonly #onFound: (update: AppUpdate) => void
  #found: AppUpdate | null = null

  constructor(onFound: (update: AppUpdate) => void) {
    this.#onFound = onFound
  }

  /** The update found so far, for a window that opens after it was found. */
  get found(): AppUpdate | null {
    return this.#found
  }

  start(): void {
    // A build run from the repo has no feed and nothing to replace.
    if (!app.isPackaged) return

    const selfReplacing = canReplaceItself()
    autoUpdater.autoDownload = selfReplacing
    if (selfReplacing) {
      autoUpdater.on('update-downloaded', (info) => {
        this.#report({ version: info.version, install: 'restart' })
      })
    } else {
      autoUpdater.on('update-available', (info) => {
        this.#report({ version: info.version, install: 'manual' })
      })
    }
    // The updater logs its own errors; without a listener an 'error' event would throw.
    autoUpdater.on('error', () => undefined)

    const check = (): void => {
      autoUpdater.checkForUpdates().catch(() => undefined)
    }
    check()
    setInterval(check, CHECK_INTERVAL_MS)
  }

  restart(): void {
    if (this.#found?.install !== 'restart') return
    // The new version is started before this one is gone, and would give up at the lock.
    app.releaseSingleInstanceLock()
    // Without an installer window, and the app comes back by itself.
    autoUpdater.quitAndInstall(true, true)
  }

  async openDownloadPage(): Promise<void> {
    await shell.openExternal(DOWNLOAD_PAGE)
  }

  #report(update: AppUpdate): void {
    this.#found = update
    this.#onFound(update)
  }
}
