import { motion, useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'
import { useState } from 'react'
import type { DayProgress } from '@/domain/todo-rules'
import { CLEARED, RING } from '../lib/motion'
import styles from './ProgressRing.module.css'

interface ProgressRingProps {
  readonly progress: DayProgress
  /** `lg` is the one in the header of the card in front, `sm` the one on the tab of a card behind. */
  readonly size?: 'lg' | 'md' | 'sm'
}

// Starting from `null` means from wherever the scale is, so the pop can be interrupted like the rest.
const POP = [null, 0.86, 1.14, 1]
const INSTANT: Transition = { duration: 0 }

/**
 * How close the day is to cleared, without saying how much was done: a ring and no count. When the
 * last open todo is resolved the ring closes and turns into a check, once, while it is watched; a
 * day that is already cleared when its card appears just shows the check.
 */
export function ProgressRing({ progress, size = 'md' }: ProgressRingProps) {
  const { resolved, total, cleared } = progress
  const phase = cleared ? 'on' : 'off'
  // Under reduced motion only opacity changes: the arc and the check are simply there.
  const still = useReducedMotion() === true

  // Counts the times the day was cleared while the ring was mounted: each one sends out one halo.
  const [wasCleared, setWasCleared] = useState(cleared)
  const [bursts, setBursts] = useState(0)
  if (cleared !== wasCleared) {
    setWasCleared(cleared)
    if (cleared) setBursts(bursts + 1)
  }

  const draw: Transition = still ? INSTANT : CLEARED.draw[phase]
  // A round line cap leaves a dot at `pathLength: 0`, so the tick is hidden whenever it is not drawn.
  const reveal: Transition = { duration: 0.01, delay: (cleared ? draw.delay : draw.duration) ?? 0 }

  return (
    <span
      className={styles.ring}
      data-size={size}
      role="progressbar"
      aria-label="Day progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={resolved}
      aria-valuetext={`${String(resolved)} of ${String(total)} resolved`}
    >
      <motion.svg
        className={styles.svg}
        viewBox="0 0 16 16"
        aria-hidden="true"
        initial={false}
        animate={{ scale: cleared ? POP : 1 }}
        transition={cleared ? CLEARED.pop : CLEARED.fill.off}
      >
        {bursts > 0 && cleared && !still && (
          <motion.circle
            key={bursts}
            className={styles.halo}
            cx="8"
            cy="8"
            r="6.5"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.45, 0], scale: 2.4 }}
            transition={{ ...CLEARED.halo, opacity: { ...CLEARED.halo, times: [0, 0.15, 1] } }}
          />
        )}
        <circle className={styles.track} cx="8" cy="8" r="6.5" />
        {/* Turned so that the arc starts at twelve o'clock. */}
        <g transform="rotate(-90 8 8)">
          <motion.circle
            className={styles.arc}
            cx="8"
            cy="8"
            r="6.5"
            initial={false}
            animate={{ pathLength: total === 0 ? 0 : resolved / total }}
            transition={still ? INSTANT : RING}
          />
        </g>
        <motion.circle
          className={styles.disc}
          cx="8"
          cy="8"
          r="7.75"
          initial={false}
          animate={{ opacity: cleared ? 1 : 0 }}
          transition={CLEARED.fill[phase]}
        />
        <motion.path
          className={styles.tick}
          d="M4.8 8.3l2.2 2.2 4.2-4.6"
          initial={false}
          animate={{ pathLength: cleared ? 1 : 0, opacity: cleared ? 1 : 0 }}
          transition={{ pathLength: draw, opacity: reveal }}
        />
      </motion.svg>
    </span>
  )
}
