import { useLineField } from './TodoEditor'
import type { EditorClose } from './TodoEditor'

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
  const field = useLineField('', (next, how) => {
    if (how !== 'escape' && next !== '') onAdd(next)
    if (how !== 'enter' || next === '') onClose(how)
  })
  return <textarea {...field} aria-label="New step" placeholder={first ? 'First step…' : 'Next step…'} />
}
