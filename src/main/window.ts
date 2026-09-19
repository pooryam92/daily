import { BrowserWindow } from 'electron'
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_HTML_PATH } from './env'

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 420,
    webPreferences: {
      preload: PRELOAD_PATH,
      // These are Electron's defaults; spelled out because the app's security relies on them.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  // Hide the File/Edit/… bar but keep the default menu so its shortcuts still work.
  win.setMenuBarVisibility(false)

  // The app is a single page: never open new windows or navigate away from it.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  const loaded = DEV_SERVER_URL === null ? win.loadFile(RENDERER_HTML_PATH) : win.loadURL(DEV_SERVER_URL)
  loaded.catch((error: unknown) => {
    console.error('Could not load the renderer:', error)
  })

  return win
}
