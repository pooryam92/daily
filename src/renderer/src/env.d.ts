/// <reference types="vite/client" />
import type { DailyApi } from '@shared/ipc'

declare global {
  const __STYLE_NONCE__: string
  interface Window {
    /** Exposed by the preload script, see src/preload/index.ts. */
    readonly api: DailyApi
  }
}
