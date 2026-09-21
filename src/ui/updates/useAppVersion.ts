import { useEffect, useState } from 'react'
import { useGateway } from '../gateway'

/** The version of the running app; null until it is known. It is only ever shown, never relied on. */
export function useAppVersion(): string | null {
  const gateway = useGateway()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    gateway.app.version().then(
      (loaded) => {
        if (!cancelled) setVersion(loaded)
      },
      (error: unknown) => {
        console.error('Could not read the app version:', error)
      }
    )
    return () => {
      cancelled = true
    }
  }, [gateway])

  return version
}
