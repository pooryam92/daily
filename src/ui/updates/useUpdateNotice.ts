import { useEffect } from 'react'
import { toast } from 'sonner'
import type { AppUpdate } from '@/ports'
import { useGateway } from '../gateway'

/** One id for every update toast: a newer update replaces the toast of an older one. */
const TOAST_ID = 'update'

/**
 * Says that a newer version is there, in a toast that stays until it is answered: the app is open
 * for days and nobody may be looking when the update arrives. Nothing depends on the answer. An
 * update that is downloaded is installed when the app quits, with or without the Restart button.
 */
export function useUpdateNotice(): void {
  const gateway = useGateway()

  useEffect(() => {
    const logFailure = (error: unknown): void => {
      console.error('The update could not be started:', error)
    }

    const show = (update: AppUpdate): void => {
      const restarts = update.install === 'restart'
      toast(restarts ? 'Update ready' : 'Update available', {
        id: TOAST_ID,
        // The toast keeps its description on one line (App.module.css), so it is only the name.
        description: `Daily ${update.version}`,
        duration: Infinity,
        action: {
          label: restarts ? 'Restart' : 'Download',
          onClick: () => {
            const started = restarts ? gateway.updates.restart() : gateway.updates.openDownloadPage()
            started.catch(logFailure)
          }
        },
        cancel: { label: 'Later', onClick: () => undefined }
      })
    }

    let cancelled = false
    const unsubscribe = gateway.updates.subscribe(show)
    // The update may have been found before this window was there to hear about it.
    gateway.updates.current().then(
      (update) => {
        if (!cancelled && update !== null) show(update)
      },
      (error: unknown) => {
        console.error('Could not ask for updates:', error)
      }
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [gateway])
}
