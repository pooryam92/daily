import { useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
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
 * todo keeps its text: deleting is a button on the row, with its own undo. Steps are added by the +
 * on the row, not here.
 */
export function TodoEditor({ text, onCommit, onClose }: TodoEditorProps) {
  const field = useLineField(text, (next, how) => {
    if (how !== 'escape' && next !== '' && next !== text) onCommit(next)
    onClose(how)
  })
  return <textarea {...field} aria-label="Edit todo" />
}

/**
 * The props of a one-line field, a todo's or a step's, that ends once: on Enter, on Escape, or when
 * it is left. It takes the keyboard as it shows, with the cursor at the end, where a sentence is
 * carried on and most slips are made. `onEnd` gets the text as it would be saved.
 */
export function useLineField(initial: string, onEnd: (text: string, how: EditorClose) => void) {
  const [draft, setDraft] = useState(initial)
  const field = useRef<HTMLTextAreaElement>(null)
  // Whatever ends the field takes it away, which can blur it: one ending per field.
  const ended = useRef(false)

  useLayoutEffect(() => {
    const node = field.current
    if (node === null) return
    node.focus({ preventScroll: true })
    node.setSelectionRange(node.value.length, node.value.length)
  }, [])

  const end = (how: EditorClose): void => {
    if (ended.current) return
    ended.current = true
    onEnd(normalise(draft), how)
  }

  return {
    ref: field,
    className: styles.editor,
    rows: 1,
    value: draft,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>): void => {
      setDraft(event.target.value)
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      // Enter that confirms an input method's suggestion ends nothing.
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Enter') {
        event.preventDefault()
        end('enter')
      } else if (event.key === 'Escape') {
        end('escape')
      }
    },
    onBlur: (): void => {
      end('blur')
    }
  }
}

/** A todo, or a step, is one line however it was typed or pasted; the row wraps it as needed. */
export const normalise = (text: string): string => text.trim().replace(/\s+/g, ' ')
