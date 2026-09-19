import { BrowserWindow, nativeTheme } from 'electron'
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_HTML_PATH } from './env'

/** The renderer's `--bg` token per theme (styles/global.css); keep the two in sync. */
const BACKGROUND = { light: '#eceae4', dark: '#191816' } as const

const backgroundColor = (): string => (nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light)

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    // The name is the key Electron stores this window's size and position under.
    name: 'main',
    windowStatePersistence: true,
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 420,
    // Painted before the page is: without it every launch starts with a white flash.
    backgroundColor: backgroundColor(),
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      // These are Electron's defaults; spelled out because the app's security relies on them.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  // The theme can change while the app runs (the OS, or the setting); the colour behind the page
  // shows while the window is resized, so it has to follow.
  const followTheme = (): void => {
    win.setBackgroundColor(backgroundColor())
  }
  nativeTheme.on('updated', followTheme)
  win.once('closed', () => {
    nativeTheme.off('updated', followTheme)
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
    // 'ready-to-show' may never come now; an empty window beats an invisible app.
    if (!win.isDestroyed()) win.show()
  })

  return win
}
