import type { Settings, ThemeMode } from './domain/settings'
import type { StoreData } from './domain/store'

/**
 * What the UI needs from the platform it runs on, and the only way it may reach out of itself.
 * Electron implements it over IPC (`src/electron`); another platform would implement it its own way.
 */
export interface DailyGateway {
  readonly todos: TodoGateway
  readonly settings: SettingsGateway
  readonly app: AppGateway
  readonly updates: UpdateGateway
}

/** Where the todos are kept. The whole document is read and written at once; it is small. */
export interface TodoGateway {
  readonly load: () => Promise<StoreData>
  readonly save: (data: StoreData) => Promise<void>
}

/** What the UI may know about the app it is part of. */
export interface AppGateway {
  readonly version: () => Promise<string>
}

/** A newer version of the app, reported once there is something the user can do about it. */
export interface AppUpdate {
  readonly version: string
  /**
   * `restart`: it is downloaded, and a restart installs it. `manual`: this install cannot replace
   * itself (a Linux package belongs to the package manager), so it has to be downloaded by hand.
   */
  readonly install: 'restart' | 'manual'
}

/** Updates are found by the platform on its own schedule; the UI only hears about them. */
export interface UpdateGateway {
  /** The update found so far: the UI may start after it was found. */
  readonly current: () => Promise<AppUpdate | null>
  /** Calls the listener for every update found from now on. Returns the way to unsubscribe. */
  readonly subscribe: (listener: (update: AppUpdate) => void) => () => void
  /** Restarts the app into a `restart` update. */
  readonly restart: () => Promise<void>
  /** Opens the page a `manual` update is downloaded from. */
  readonly openDownloadPage: () => Promise<void>
}

export interface SettingsGateway {
  readonly load: () => Promise<Settings>
  /**
   * Saves the theme and applies it: by switching the scheme of the whole window where the platform
   * can, otherwise by setting `data-theme` on the root element (see `ui/styles/global.css`).
   */
  readonly setTheme: (theme: ThemeMode) => Promise<void>
  readonly setSound: (sound: boolean) => Promise<void>
}
