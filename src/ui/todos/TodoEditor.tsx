import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import styles from './TodoEditor.module.css'

/** What ended the edit. Only after Enter and Escape is the keyboard still on this row. */
export type EditorClose = 'enter' | 'escape' | 'blur' | 'delete'

interface TodoEditorProps {
  readonly text: string
  /** Called with the new text, and only if there is something new to save. */
  readonly onCommit: (text: string) => void
  /** Deletes the todo; the draft is not saved. */
  readonly onDelete: () => void
  readonly onClose: (how: EditorClose) => void
}

/**
 * A todo's text, edited where it stands. Enter saves and so does leaving the field, like everywhere
 * else in the app where a change is never asked about; Escape puts the old text back. An emptied
 * todo keeps its text: deleting is the word after the field, with its own undo. It lives here
 * because it is rare and changes the todo rather than its day.
 */
export function TodoEditor({ text, onCommit, onDelete, onClose }: TodoEditorProps) {
  const [draft, setDraft] = useState(text)
  const field = useRef<HTMLTextAreaElement>(null)
  const remove = useRef<HTMLButtonElement>(null)
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
    // A todo is one line, however it was typed or pasted; the row wraps it as needed.
    const next = draft.trim().replace(/\s+/g, ' ')
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

  // Focus moving between the field and its delete button stays in the editor; anywhere else ends it.
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
          if (leaving(event, remove.current)) close('blur')
        }}
      />
      <button
        ref={remove}
        type="button"
        className={styles.remove}
        onMouseDown={(event) => {
          // A blur first would save the draft before deleting it.
          event.preventDefault()
        }}
        onBlur={(event) => {
          if (leaving(event, field.current)) close('blur')
        }}
        onClick={() => {
          if (closed.current) return
          closed.current = true
          onClose('delete')
          onDelete()
        }}
      >
        delete
      </button>
    </>
  )
}
