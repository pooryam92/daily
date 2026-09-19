import { contextBridge, ipcRenderer } from 'electron'
import type { DailyApi, IpcChannel, IpcContract } from '../shared/ipc'

// The preload script is sandboxed: it can only import `electron` at runtime.
// Imports from ../shared must stay type-only.

function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcContract[C]['args']
): Promise<IpcContract[C]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[C]['result']>
}

const api: DailyApi = {
  store: {
    load: () => invoke('store:load'),
    save: (data) => invoke('store:save', data)
  },
  settings: {
    load: () => invoke('settings:load'),
    setTheme: (theme) => invoke('settings:setTheme', theme),
    setSound: (sound) => invoke('settings:setSound', sound)
  }
}

contextBridge.exposeInMainWorld('api', api)
