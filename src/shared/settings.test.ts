import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, isThemeMode, parseSettings } from './settings'

describe('isThemeMode', () => {
  it('accepts the three modes only', () => {
    expect(isThemeMode('system')).toBe(true)
    expect(isThemeMode('light')).toBe(true)
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('auto')).toBe(false)
    expect(isThemeMode(undefined)).toBe(false)
  })
})

describe('parseSettings', () => {
  it('accepts valid settings', () => {
    expect(parseSettings({ theme: 'dark', sound: true })).toEqual({ theme: 'dark', sound: true })
  })

  it('keeps sound off unless it is switched on', () => {
    expect(parseSettings({ theme: 'dark' })).toEqual({ theme: 'dark', sound: false })
    expect(parseSettings({ theme: 'dark', sound: 'yes' })).toEqual({ theme: 'dark', sound: false })
  })

  it('falls back to the default for an unknown or missing theme', () => {
    expect(parseSettings({ theme: 'sepia' })).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the defaults for anything that is not an object', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS)
  })

  it('strips unknown fields', () => {
    expect(parseSettings({ theme: 'light', extra: true })).toEqual({ theme: 'light', sound: false })
  })
})
