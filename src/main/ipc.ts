import { ipcMain } from 'electron'
import type { IpcChannel, IpcContract } from '../shared/ipc'
import { parseStoreData } from '../shared/store-schema'
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

export function registerIpcHandlers(store: TodoStore): void {
  handle('store:load', () => store.load())
  handle('store:save', async (data) => {
    await store.save(parseStoreData(data))
    return undefined
  })
}
