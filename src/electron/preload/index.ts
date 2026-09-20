import { contextBridge, ipcRenderer } from 'electron'
import type { DailyGateway } from '../../application/ports'
import type { IpcChannel, IpcContract } from '../ipc-contract'

// The preload script is sandboxed: it can only import `electron` at runtime.
// Every other import must stay type-only.

function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcContract[C]['args']
): Promise<IpcContract[C]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[C]['result']>
}

/** Electron's implementation of the gateway the UI talks to, exposed to the renderer as `window.api`. */
const gateway: DailyGateway = {
  todos: {
    load: () => invoke('todos:load'),
    save: (data) => invoke('todos:save', data)
  },
  settings: {
    load: () => invoke('settings:load'),
    setTheme: (theme) => invoke('settings:setTheme', theme),
    setSound: (sound) => invoke('settings:setSound', sound)
  },
  app: {
    version: () => invoke('app:version')
  }
}

contextBridge.exposeInMainWorld('api', gateway)
