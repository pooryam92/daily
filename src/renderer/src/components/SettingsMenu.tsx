import { CSPProvider } from '@base-ui/react/csp-provider'
import { Popover } from '@base-ui/react/popover'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Monitor, Moon, Settings, Sun } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { isThemeMode } from '@shared/settings'
import type { ThemeMode } from '@shared/settings'
import { useTheme } from '../hooks/useTheme'
import { SEGMENT } from '../lib/motion'
import styles from './SettingsMenu.module.css'

const THEMES = [
  { mode: 'system', label: 'Auto', Icon: Monitor },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon }
] as const satisfies readonly { mode: ThemeMode; label: string; Icon: typeof Sun }[]

/** The app's one home for preferences: a quiet button in the corner of the window. */
export function SettingsMenu() {
  const theme = useTheme()
  const themeLabel = useId()
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
                value={theme.mode}
                onValueChange={(mode) => {
                  if (isThemeMode(mode)) theme.setMode(mode)
                }}
              >
                {THEMES.map(({ mode, label, Icon }) => (
                  <Radio.Root key={mode} value={mode} className={styles.segment}>
                    {theme.mode === mode && (
                      <motion.span className={styles.pill} layoutId={pill} transition={SEGMENT} />
                    )}
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </Radio.Root>
                ))}
              </RadioGroup>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </CSPProvider>
  )
}
