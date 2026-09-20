import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { DailyGateway } from '@/application/ports'
import { App } from '@/ui/App'
import { GatewayProvider } from '@/ui/gateway'
import '@/ui/styles/global.css'

declare global {
  interface Window {
    /** Electron's gateway, exposed by the preload script (src/electron/preload/index.ts). */
    readonly api: DailyGateway
  }
}

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root element')

createRoot(root).render(
  <StrictMode>
    <GatewayProvider gateway={window.api}>
      <App />
    </GatewayProvider>
  </StrictMode>
)
