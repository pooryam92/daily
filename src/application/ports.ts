import type { Settings, ThemeMode } from '../domain/settings'
import type { StoreData } from '../domain/store'

/**
 * What the UI needs from the platform it runs on, and the only way it may reach out of itself.
 * Electron implements it over IPC (`src/electron`); another platform would implement it its own way.
 */
export interface DailyGateway {
  readonly todos: TodoGateway
  readonly settings: SettingsGateway
  readonly app: AppGateway
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

export interface SettingsGateway {
  readonly load: () => Promise<Settings>
  /**
   * Saves the theme and applies it: by switching the scheme of the whole window where the platform
   * can, otherwise by setting `data-theme` on the root element (see `ui/styles/global.css`).
   */
  readonly setTheme: (theme: ThemeMode) => Promise<void>
  readonly setSound: (sound: boolean) => Promise<void>
}
