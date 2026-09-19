import styles from './App.module.css'
import { DayStack } from './components/DayStack'
import { useDayNavigation } from './hooks/useDayNavigation'
import { useTodoStore } from './hooks/useTodoStore'
import { useToday } from './hooks/useToday'

export function App() {
  const today = useToday()
  const navigation = useDayNavigation(today)
  const store = useTodoStore()

  if (store.phase === 'loading') return null

  if (store.phase === 'failed') {
    return (
      <main className={styles.app}>
        <p className={styles.message} role="alert">
          Could not load your todos: {store.error}
        </p>
      </main>
    )
  }

  return (
    <main className={styles.app}>
      {store.saveError !== null && (
        <p className={styles.banner} role="alert">
          Your last change was not saved: {store.saveError}
        </p>
      )}
      <DayStack today={today} days={store.days} actions={store.actions} navigation={navigation} />
    </main>
  )
}
