import { motion, useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'
import { CHECK } from '../lib/motion'
import styles from './DoneCheckbox.module.css'

interface DoneCheckboxProps {
  readonly checked: boolean
  /** Left out for a box that cannot be checked yet, which is then disabled. */
  readonly onChange?: () => void
  /** A step's box is drawn smaller than a todo's, in a hit area of the same size. */
  readonly size?: 'md' | 'sm'
}

/**
 * The app's one reward moment. The native checkbox does the work (keyboard, focus, screen readers);
 * the SVG on top of it is decoration. Only opacity and `pathLength` are animated, from wherever
 * they are right now, so a second click mid-animation simply turns it around.
 */
export function DoneCheckbox({ checked, onChange, size = 'md' }: DoneCheckboxProps) {
  const phase = checked ? 'on' : 'off'
  // Drawing the check is motion; the fade is not. Under reduced motion the check appears with the fill.
  const draw: Transition = useReducedMotion() === true ? { duration: 0 } : CHECK.draw[phase]
  // A round line cap leaves a dot at `pathLength: 0`, so the tick is hidden whenever it is not drawn.
  const reveal: Transition = { duration: 0.01, delay: (checked ? draw.delay : draw.duration) ?? 0 }

  return (
    <label className={styles.check} data-size={size}>
      <input
        type="checkbox"
        className={styles.input}
        aria-label="Done"
        checked={checked}
        disabled={onChange === undefined}
        onChange={onChange}
      />
      <svg className={styles.box} viewBox="0 0 18 18" aria-hidden="true">
        <rect className={styles.outline} x="1.75" y="1.75" width="14.5" height="14.5" rx="4.5" />
        <motion.rect
          className={styles.fill}
          x="1.75"
          y="1.75"
          width="14.5"
          height="14.5"
          rx="4.5"
          initial={false}
          animate={{ opacity: checked ? 1 : 0 }}
          transition={CHECK.fill[phase]}
        />
        <motion.path
          className={styles.tick}
          d="M5.25 9.4l2.6 2.6 4.9-5.4"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ pathLength: draw, opacity: reveal }}
        />
      </svg>
    </label>
  )
}
