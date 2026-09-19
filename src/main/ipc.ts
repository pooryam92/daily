import { ipcMain, nativeTheme } from 'electron'
import type { IpcChannel, IpcContract } from '../shared/ipc'
import { isThemeMode } from '../shared/settings'
import { parseStoreData } from '../shared/store-schema'
import type { SettingsStore } from './settings-store'
import type { TodoStore } from './todo-store'

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

export function registerIpcHandlers(store: TodoStore, settings: SettingsStore): void {
  handle('store:load', () => store.load())
  handle('store:save', async (data) => {
    await store.save(parseStoreData(data))
    return undefined
  })

  handle('settings:load', () => settings.settings)
  handle('settings:setTheme', async (theme) => {
    if (!isThemeMode(theme)) throw new TypeError('Unknown theme')
    // This is the whole theme switch: it flips `prefers-color-scheme` for the renderer.
    nativeTheme.themeSource = theme
    await settings.update({ theme })
    return undefined
  })
}
