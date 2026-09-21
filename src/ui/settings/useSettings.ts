import { useCallback, useEffect, useState } from 'react'
import type { Settings, ThemeMode } from '@/domain/settings'
import { useGateway } from '../gateway'

export interface SettingsState {
  /** Null until the settings have been read. */
  readonly settings: Settings | null
  readonly setTheme: (theme: ThemeMode) => void
  readonly setSound: (sound: boolean) => void
}

/**
 * The user's preferences. For the theme only the choice lives here: applying it is the gateway's
 * business (see `SettingsGateway.setTheme`), and the stylesheet only follows `color-scheme`.
 */
export function useSettings(): SettingsState {
  const gateway = useGateway()
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let cancelled = false
    gateway.settings.load().then(
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
  }, [gateway])

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      setSettings((current) => current && { ...current, theme })
      gateway.settings.setTheme(theme).catch((error: unknown) => {
        // The theme did change (that happens first); it just will not be remembered.
        console.error('Could not save the theme:', error)
      })
    },
    [gateway]
  )

  const setSound = useCallback(
    (sound: boolean) => {
      setSettings((current) => current && { ...current, sound })
      gateway.settings.setSound(sound).catch((error: unknown) => {
        console.error('Could not save the sound setting:', error)
      })
    },
    [gateway]
  )

  return { settings, setTheme, setSound }
}
