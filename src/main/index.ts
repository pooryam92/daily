import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { registerIpcHandlers } from './ipc'
import { TodoStore } from './todo-store'
import { createMainWindow } from './window'

async function main(): Promise<void> {
  await app.whenReady()

  registerIpcHandlers(new TodoStore(path.join(app.getPath('userData'), 'todos.json')))
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
