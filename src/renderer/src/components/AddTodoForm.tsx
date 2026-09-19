import { useState } from 'react'
import type { SubmitEvent } from 'react'
import styles from './AddTodoForm.module.css'

interface AddTodoFormProps {
  readonly onAdd: (text: string) => void
}

export function AddTodoForm({ onAdd }: AddTodoFormProps) {
  const [draft, setDraft] = useState('')

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const text = draft.trim()
    if (text === '') return
    onAdd(text)
    setDraft('')
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        // The form only exists on the card in front, so it takes focus whenever the day changes.
        autoFocus
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        placeholder="Add a todo…"
        aria-label="Add a todo"
      />
    </form>
  )
}
