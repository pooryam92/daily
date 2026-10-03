import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { normalise } from './TodoEditor'
import type { EditorClose } from './TodoEditor'
import styles from './TodoEditor.module.css'

interface StepDraftProps {
  /** Whether it would be the todo's first step. */
  readonly first: boolean
  /** Adds the step. After Enter the draft stays open: the parent gives it a new key, so it starts empty. */
  readonly onAdd: (text: string) => void
  readonly onClose: (how: EditorClose) => void
}

/**
 * A step being written, under its todo. Enter adds it and the next one is written straight after,
 * so a list of steps is typed in one go; Enter on an empty field is the way out. Leaving the field
 * adds what was written, like everywhere else in the app, and Escape adds nothing. Unlike the
 * editor (`TodoEditor`), there is no old text to fall back on: an empty draft is no step at all.
 */
export function StepDraft({ first, onAdd, onClose }: StepDraftProps) {
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  // Whatever ends the draft takes the field away, which can blur it: one ending per draft.
  const ended = useRef(false)

  useLayoutEffect(() => {
    field.current?.focus({ preventScroll: true })
  }, [])

  const end = (how: EditorClose): void => {
    if (ended.current) return
    ended.current = true
    const next = normalise(draft)
    if (how !== 'escape' && next !== '') onAdd(next)
    if (how !== 'enter' || next === '') onClose(how)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter that confirms an input method's suggestion does not add the step.
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      end('enter')
    } else if (event.key === 'Escape') {
      end('escape')
    }
  }

  return (
    <textarea
      ref={field}
      className={styles.editor}
      rows={1}
      aria-label="New step"
      placeholder={first ? 'First step…' : 'Next step…'}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onKeyDown={onKeyDown}
      onBlur={() => {
        end('blur')
      }}
    />
  )
}
