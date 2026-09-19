import { useCallback, useEffect, useState } from 'react'
import type { ThemeMode } from '@shared/settings'

export interface Theme {
  /** Null until the setting has been read. */
  readonly mode: ThemeMode | null
  readonly setMode: (mode: ThemeMode) => void
}

/**
 * The theme setting. Only the choice lives here: the main process applies it to the whole window
 * (`nativeTheme.themeSource`), which flips `prefers-color-scheme`, so no stylesheet knows about it.
 */
export function useTheme(): Theme {
  const [mode, setModeState] = useState<ThemeMode | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.settings.load().then(
      ({ theme }) => {
        if (!cancelled) setModeState(theme)
      },
      (error: unknown) => {
        console.error('Could not load the settings:', error)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.api.settings.setTheme(next).catch((error: unknown) => {
      // The theme did change (that happens first); it just will not be remembered.
      console.error('Could not save the theme:', error)
    })
  }, [])

  return { mode, setMode }
}
