/** `system` follows the operating system. */
export const THEME_MODES = ['system', 'light', 'dark'] as const

export type ThemeMode = (typeof THEME_MODES)[number]

/** The user's preferences, persisted next to the todos. */
export interface Settings {
  readonly theme: ThemeMode
  /** Off unless asked for: whether sound is welcome depends on where the app is used. */
  readonly sound: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', sound: false }
