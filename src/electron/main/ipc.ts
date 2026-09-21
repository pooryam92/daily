import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { isThemeMode } from '../../domain/settings-schema'
import { parseStoreData } from '../../domain/store-schema'
import type { IpcChannel, IpcContract, IpcEventChannel, IpcEvents } from '../ipc-contract'
import type { SettingsStore } from './settings-store'
import type { TodoStore } from './todo-store'
import type { Updater } from './updater'

type Result<C extends IpcChannel> = IpcContract[C]['result']

/**
 * Registers a handler for a channel of the IPC contract. The arguments are `unknown` on purpose:
 * they come from the renderer, so a handler has to validate them before use.
 */
function handle<C extends IpcChannel>(
  channel: C,
  handler: (...args: unknown[]) => Promise<Result<C>> | Result<C>
): void {
  ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(...args))
}

/** Sends an event of the IPC contract to every open window. */
export function broadcast<C extends IpcEventChannel>(channel: C, payload: IpcEvents[C]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}

export function registerIpcHandlers(store: TodoStore, settings: SettingsStore, updater: Updater): void {
  handle('todos:load', () => store.load())
  handle('todos:save', async (data) => {
    await store.save(parseStoreData(data))
    return undefined
  })

  handle('settings:load', () => settings.settings)
  handle('settings:setTheme', async (theme) => {
    if (!isThemeMode(theme)) throw new TypeError('Unknown theme')
    // This is the whole theme switch: it flips the renderer's colour scheme, which the stylesheet follows.
    // `ThemeMode` has the values of `themeSource`.
    nativeTheme.themeSource = theme
    await settings.update({ theme })
    return undefined
  })
  handle('settings:setSound', async (sound) => {
    if (typeof sound !== 'boolean') throw new TypeError('Sound is on or off')
    await settings.update({ sound })
    return undefined
  })

  handle('app:version', () => app.getVersion())

  handle('update:current', () => updater.found)
  handle('update:restart', () => {
    updater.restart()
    return undefined
  })
  handle('update:openDownloadPage', async () => {
    await updater.openDownloadPage()
    return undefined
  })
}
