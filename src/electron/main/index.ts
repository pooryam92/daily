import path from 'node:path'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { broadcast, registerIpcHandlers } from './ipc'
import { SettingsStore } from './settings-store'
import { TodoStore } from './todo-store'
import { Updater } from './updater'
import { createMainWindow } from './window'

async function main(): Promise<void> {
  await app.whenReady()

  const userData = app.getPath('userData')
  const settings = new SettingsStore(path.join(userData, 'settings.json'))
  // Before the window exists, so it is created in the right colours.
  nativeTheme.themeSource = settings.settings.theme

  const todos = new TodoStore(path.join(userData, 'todos.json'))
  // Before anything can save. A failed backup is no reason to keep the app from starting.
  await todos.backupBefore(app.getVersion()).catch((error: unknown) => {
    console.error('Could not back up the todos:', error)
  })

  const updater = new Updater((update) => {
    broadcast('update:found', update)
  })
  registerIpcHandlers(todos, settings, updater)
  createMainWindow()
  updater.start()

  // macOS: re-create the window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  // A second launch ends up here instead of opening its own window.
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0] ?? createMainWindow()
    if (win.isMinimized()) win.restore()
    win.focus()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/**
 * Electron names the data folder after the app, and the packaged app is called "Daily": left
 * alone, an installed build would look in ~/.config/Daily and open without the existing todos.
 * A build run from the repo gets its own folder, so development never touches the real todos and
 * can run next to the installed app. `--user-data-dir` still wins over both.
 */
function pinUserDataFolder(): void {
  if (app.commandLine.hasSwitch('user-data-dir')) return
  app.setPath('userData', path.join(app.getPath('appData'), app.isPackaged ? 'daily' : 'daily-dev'))
}

// Before the lock, which is a file in that folder.
pinUserDataFolder()

// Every instance holds the whole store in memory and rewrites the whole file, so a second one
// would silently overwrite the first one's todos. It hands over to the first and exits.
if (app.requestSingleInstanceLock()) {
  main().catch((error: unknown) => {
    console.error('Failed to start:', error)
    app.exit(1)
  })
} else {
  app.quit()
}
