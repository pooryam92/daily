import type { StoreData } from './todo'

/**
 * Every IPC channel between the renderer and the main process.
 * Both `handle` (main) and `invoke` (preload) are typed against this contract,
 * so a channel name or payload can't drift between the two sides.
 */
export interface IpcContract {
  'store:load': { args: []; result: StoreData }
  'store:save': { args: [data: StoreData]; result: undefined }
}

export type IpcChannel = keyof IpcContract

/** The API the preload script exposes to the renderer as `window.api`. */
export interface DailyApi {
  readonly store: {
    load: () => Promise<StoreData>
    save: (data: StoreData) => Promise<void>
  }
}
