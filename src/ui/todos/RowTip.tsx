import { Tooltip } from '@base-ui/react/tooltip'
import type { ReactElement } from 'react'
import styles from './RowTip.module.css'

/**
 * A row button's name, shown above it a moment after the pointer rests on it (RowMenus sets how long),
 * at once when the keyboard reaches it, and never on touch, where the icons stay in view. The button
 * keeps its own longer name for screen readers.
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
