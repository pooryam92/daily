import path from 'node:path'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { registerIpcHandlers } from './ipc'
import { SettingsStore } from './settings-store'
import { TodoStore } from './todo-store'
import { createMainWindow } from './window'

async function main(): Promise<void> {
  await app.whenReady()

  const userData = app.getPath('userData')
  const settings = new SettingsStore(path.join(userData, 'settings.json'))
  // Before the window exists, so it is created in the right colours.
  nativeTheme.themeSource = settings.settings.theme

  registerIpcHandlers(new TodoStore(path.join(userData, 'todos.json')), settings)
  createMainWindow()

  // macOS: re-create the window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

main().catch((error: unknown) => {
  console.error('Failed to start:', error)
  app.exit(1)
})
