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
 * A step being written under its todo. Enter adds it and starts the next, and Enter on an empty field is
 * the way out; leaving the field adds what was written, Escape adds nothing. Unlike `TodoEditor` there is
 * no old text to fall back on: an empty draft is no step at all.
 */
export function StepDraft({ first, onAdd, onClose }: StepDraftProps) {
  const field = useLineField('', (next, how) => {
    if (how !== 'escape' && next !== '') onAdd(next)
    if (how !== 'enter' || next === '') onClose(how)
  })
  return <textarea {...field} aria-label="New step" placeholder={first ? 'First step…' : 'Next step…'} />
}
