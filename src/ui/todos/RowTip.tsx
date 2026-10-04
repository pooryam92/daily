import { Tooltip } from '@base-ui/react/tooltip'
import type { ReactElement } from 'react'
import styles from './RowTip.module.css'

/**
 * A row button's name above it: after the pointer rests (RowMenus sets how long), at once from the
 * keyboard, never on touch. The button keeps its own longer name for screen readers.
 */
export function RowTip({ tip, children }: { readonly tip: string; readonly children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner className={styles.positioner} side="top" sideOffset={6} collisionPadding={8}>
          <Tooltip.Popup className={styles.tip} role="tooltip">
            {tip}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
