import { contextBridge, ipcRenderer } from 'electron'
import type { DailyGateway } from '../../ports'
import type { IpcChannel, IpcContract, IpcEventChannel, IpcEvents } from '../ipc-contract'

// The preload script is sandboxed: it can only import `electron` at runtime.
// Every other import must stay type-only.

function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcContract[C]['args']
): Promise<IpcContract[C]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[C]['result']>
}

/** Listens to an event of the main process. Returns the way to stop listening. */
function listen<C extends IpcEventChannel>(
  channel: C,
  listener: (payload: IpcEvents[C]) => void
): () => void {
  const handler = (_event: unknown, payload: IpcEvents[C]): void => {
    listener(payload)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
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
  },
  updates: {
    current: () => invoke('update:current'),
    subscribe: (listener) => listen('update:found', listener),
    restart: () => invoke('update:restart'),
    openDownloadPage: () => invoke('update:openDownloadPage')
  }
}

contextBridge.exposeInMainWorld('api', gateway)
