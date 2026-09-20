import { CSPProvider } from '@base-ui/react/csp-provider'
import { Popover } from '@base-ui/react/popover'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Switch } from '@base-ui/react/switch'
import { Monitor, Moon, Settings, Sun } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { isThemeMode } from '@/domain/settings-schema'
import type { ThemeMode } from '@/domain/settings'
import type { SettingsState } from '../hooks/useSettings'
import { SEGMENT } from '../lib/motion'
import { play } from '../lib/sound'
import styles from './SettingsMenu.module.css'

const THEMES = [
  { mode: 'system', label: 'Auto', Icon: Monitor },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon }
] as const satisfies readonly { mode: ThemeMode; label: string; Icon: typeof Sun }[]

interface SettingsMenuProps extends SettingsState {
  /** Null until it is known; the line is left out until then. */
  readonly version: string | null
}

/** The app's one home for preferences: a quiet button in the corner of the window. */
export function SettingsMenu({ settings, setTheme, setSound, version }: SettingsMenuProps) {
  const themeLabel = useId()
  const soundLabel = useId()
  const pill = useId()

  return (
    // The built page's CSP allows no inline <style>; Base UI works without the ones it would add.
    <CSPProvider disableStyleElements>
      <Popover.Root>
        <Popover.Trigger className={styles.trigger} aria-label="Settings">
          <Settings size={16} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className={styles.positioner} side="top" align="start" sideOffset={8}>
            <Popover.Popup className={styles.popup}>
              <Popover.Title id={themeLabel} className={styles.label}>
                Theme
              </Popover.Title>
              <RadioGroup
                className={styles.segments}
                aria-labelledby={themeLabel}
                value={settings?.theme ?? null}
                onValueChange={(mode) => {
                  if (isThemeMode(mode)) setTheme(mode)
                }}
              >
                {THEMES.map(({ mode, label, Icon }) => (
                  <Radio.Root key={mode} value={mode} className={styles.segment}>
                    {settings?.theme === mode && (
                      <motion.span className={styles.pill} layoutId={pill} transition={SEGMENT} />
                    )}
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </Radio.Root>
                ))}
              </RadioGroup>
              <div className={styles.row}>
                <span id={soundLabel} className={styles.label}>
                  Sound
                </span>
                <Switch.Root
                  className={styles.switch}
                  aria-labelledby={soundLabel}
                  checked={settings?.sound ?? false}
                  onCheckedChange={(sound) => {
                    setSound(sound)
                    // Switching it on answers with the sound it switches on.
                    if (sound) play('done')
                  }}
                >
                  <Switch.Thumb className={styles.thumb} />
                </Switch.Root>
              </div>
              {version !== null && <p className={styles.version}>Daily {version}</p>}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </CSPProvider>
  )
}
