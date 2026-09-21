import type { AppUpdate } from '../ports'
import type { Settings, ThemeMode } from '../domain/settings'
import type { StoreData } from '../domain/store'

/**
 * Every IPC channel between the renderer and the main process. Both `handle` (main) and `invoke`
 * (preload) are typed against this contract, so a channel name or payload can't drift between the
 * two sides. It is Electron's way of implementing the gateway in `src/ports.ts`, and nothing
 * outside `src/electron` knows it exists.
 */
export interface IpcContract {
  'todos:load': { args: []; result: StoreData }
  'todos:save': { args: [data: StoreData]; result: undefined }
  'settings:load': { args: []; result: Settings }
  'settings:setTheme': { args: [theme: ThemeMode]; result: undefined }
  'settings:setSound': { args: [sound: boolean]; result: undefined }
  'app:version': { args: []; result: string }
  'update:current': { args: []; result: AppUpdate | null }
  'update:restart': { args: []; result: undefined }
  'update:openDownloadPage': { args: []; result: undefined }
}

export type IpcChannel = keyof IpcContract

/** What the main process tells the renderer without being asked, and the payload it sends along. */
export interface IpcEvents {
  'update:found': AppUpdate
}

export type IpcEventChannel = keyof IpcEvents
