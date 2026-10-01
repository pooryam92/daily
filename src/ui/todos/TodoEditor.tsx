import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import styles from './TodoEditor.module.css'

/**
 * What ended the edit. Only after Enter and Escape is the keyboard still on this row; after `step`
 * it goes to the step editor that opens beneath.
 */
export type EditorClose = 'enter' | 'escape' | 'blur' | 'step'

interface TodoEditorProps {
  readonly text: string
  /** Called with the new text, and only if there is something new to save. */
  readonly onCommit: (text: string) => void
  readonly onClose: (how: EditorClose) => void
  /** Whether the todo can take steps (it is open, and not a step itself): `step` then follows the field. */
  readonly canStep?: boolean
}

/**
 * A todo's text, edited where it stands. Enter saves and so does leaving the field, like everywhere
 * else in the app where a change is never asked about; Escape puts the old text back. An emptied
 * todo keeps its text: deleting is a word on the row, with its own undo. On an open todo the word
 * `step` follows the field: it saves the text as Enter does and hands over to a step editor
 * (`StepDraft`), which is the one way to add steps.
 */
export function TodoEditor({ text, onCommit, onClose, canStep = false }: TodoEditorProps) {
  const [draft, setDraft] = useState(text)
  const field = useRef<HTMLTextAreaElement>(null)
  const step = useRef<HTMLButtonElement>(null)
  // Enter closes the editor, which takes the field away, which can blur it: one close per edit.
  const closed = useRef(false)

  // The cursor starts at the end, where a sentence is carried on and most slips are made.
  useLayoutEffect(() => {
    const node = field.current
    if (node === null) return
    node.focus({ preventScroll: true })
    node.setSelectionRange(node.value.length, node.value.length)
  }, [])

  const close = (how: EditorClose): void => {
    if (closed.current) return
    closed.current = true
    const next = normalise(draft)
    if (how !== 'escape' && next !== '' && next !== text) onCommit(next)
    onClose(how)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter that confirms an input method's suggestion is not the end of the edit.
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      close('enter')
    } else if (event.key === 'Escape') {
      close('escape')
    }
  }

  // Focus moving between the field and the step word stays in the editor; anywhere else ends it.
  const leaving = (event: FocusEvent, within: HTMLElement | null): boolean =>
    within === null || event.relatedTarget !== within

  return (
    <>
      <textarea
        ref={field}
        className={styles.editor}
        rows={1}
        aria-label="Edit todo"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (leaving(event, step.current)) close('blur')
        }}
      />
      {canStep && (
        <button
          ref={step}
          type="button"
          className={styles.step}
          aria-label={`Add a step to ${text}`}
          onMouseDown={(event) => {
            // A blur first would end the edit before the step editor could open.
            event.preventDefault()
          }}
          onBlur={(event) => {
            if (leaving(event, field.current)) close('blur')
          }}
          onClick={() => {
            close('step')
          }}
        >
          step
        </button>
      )}
    </>
  )
}

/** A todo, or a step, is one line however it was typed or pasted; the row wraps it as needed. */
export const normalise = (text: string): string => text.trim().replace(/\s+/g, ' ')
