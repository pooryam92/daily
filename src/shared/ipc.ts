import type { Settings, ThemeMode } from './settings'
import type { StoreData } from './todo'

/**
 * Every IPC channel between the renderer and the main process.
 * Both `handle` (main) and `invoke` (preload) are typed against this contract,
 * so a channel name or payload can't drift between the two sides.
 */
export interface IpcContract {
  'store:load': { args: []; result: StoreData }
  'store:save': { args: [data: StoreData]; result: undefined }
  'settings:load': { args: []; result: Settings }
  'settings:setTheme': { args: [theme: ThemeMode]; result: undefined }
  'settings:setSound': { args: [sound: boolean]; result: undefined }
}

export type IpcChannel = keyof IpcContract

/** The API the preload script exposes to the renderer as `window.api`. */
export interface DailyApi {
  readonly store: {
    load: () => Promise<StoreData>
    save: (data: StoreData) => Promise<void>
  }
  readonly settings: {
    load: () => Promise<Settings>
    /** Applies the theme to the whole window at once and remembers it. */
    setTheme: (theme: ThemeMode) => Promise<void>
    setSound: (sound: boolean) => Promise<void>
  }
}
