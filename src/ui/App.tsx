import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import styles from './App.module.css'
import { DayStack } from './components/DayStack'
import { SettingsMenu } from './components/SettingsMenu'
import { useDayNavigation } from './hooks/useDayNavigation'
import { useSettings } from './hooks/useSettings'
import { useTodoStore } from './hooks/useTodoStore'
import { useToday } from './hooks/useToday'

export function App() {
  const today = useToday()
  const navigation = useDayNavigation(today)
  const store = useTodoStore()
  const settings = useSettings()

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
    // "user": under prefers-reduced-motion Motion keeps fades and drops transform and layout animations.
    <MotionConfig reducedMotion="user">
      <main className={styles.app}>
        {store.saveError !== null && (
          <p className={styles.banner} role="alert">
            Your last change was not saved: {store.saveError}
          </p>
        )}
        <DayStack
          today={today}
          days={store.days}
          actions={store.actions}
          navigation={navigation}
          sound={settings.settings?.sound ?? false}
        />
        <SettingsMenu {...settings} />
        {/* Bottom centre, lifted clear of the add-todo input so an undo toast never covers typing. */}
        <Toaster
          className={styles.toaster}
          position="bottom-center"
          offset={{ bottom: 96 }}
          theme={settings.settings?.theme ?? 'system'}
        />
      </main>
    </MotionConfig>
  )
}
