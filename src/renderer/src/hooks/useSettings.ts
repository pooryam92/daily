import { useCallback, useEffect, useState } from 'react'
import type { Settings, ThemeMode } from '@shared/settings'

export interface SettingsState {
  /** Null until the settings have been read. */
  readonly settings: Settings | null
  readonly setTheme: (theme: ThemeMode) => void
  readonly setSound: (sound: boolean) => void
}

/**
 * The user's preferences. For the theme only the choice lives here: the main process applies it to
 * the whole window (`nativeTheme.themeSource`), which flips `prefers-color-scheme`, so no stylesheet
 * knows about it.
 */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.settings.load().then(
      (loaded) => {
        if (!cancelled) setSettings(loaded)
      },
      (error: unknown) => {
        console.error('Could not load the settings:', error)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((current) => current && { ...current, theme })
    window.api.settings.setTheme(theme).catch((error: unknown) => {
      // The theme did change (that happens first); it just will not be remembered.
      console.error('Could not save the theme:', error)
    })
  }, [])

  const setSound = useCallback((sound: boolean) => {
    setSettings((current) => current && { ...current, sound })
    window.api.settings.setSound(sound).catch((error: unknown) => {
      console.error('Could not save the sound setting:', error)
    })
  }, [])

  return { settings, setTheme, setSound }
}
