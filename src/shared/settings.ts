/** `system` follows the operating system; the names are the values of Electron's `nativeTheme.themeSource`. */
export const THEME_MODES = ['system', 'light', 'dark'] as const

export type ThemeMode = (typeof THEME_MODES)[number]

/** The user's preferences, persisted next to the todos. */
export interface Settings {
  readonly theme: ThemeMode
  /** Off unless asked for: whether sound is welcome depends on where the app is used. */
  readonly sound: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', sound: false }

export const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)

/**
 * Reads settings that crossed a trust boundary (the file on disk). Unlike the todos, a preference
 * is never worth failing over: anything missing or unknown falls back to its default.
 */
export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS
  const { theme, sound } = value as Record<string, unknown>
  return {
    theme: isThemeMode(theme) ? theme : DEFAULT_SETTINGS.theme,
    sound: typeof sound === 'boolean' ? sound : DEFAULT_SETTINGS.sound
  }
}
