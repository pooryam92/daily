import { DEFAULT_SETTINGS, THEME_MODES } from './settings'
import type { Settings, ThemeMode } from './settings'

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
