import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './TodoEditor.module.css'

/** What ended the edit. Only after Enter and Escape is the keyboard still on this row. */
export type EditorClose = 'enter' | 'escape' | 'blur'

interface TodoEditorProps {
  readonly text: string
  /** Called with the new text, and only if there is something new to save. */
  readonly onCommit: (text: string) => void
  readonly onClose: (how: EditorClose) => void
}

/**
 * A todo's text, edited where it stands. Enter saves and so does leaving the field, like everywhere
 * else in the app where a change is never asked about; Escape puts the old text back. An emptied
 * todo keeps its text: deleting is a word on the row, with its own undo.
 */
export function TodoEditor({ text, onCommit, onClose }: TodoEditorProps) {
  const [draft, setDraft] = useState(text)
  const field = useRef<HTMLTextAreaElement>(null)
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

  return (
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
      onBlur={() => {
        close('blur')
      }}
    />
  )
}
