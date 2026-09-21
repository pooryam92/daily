import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import type { DailyGateway } from '@/ports'

const GatewayContext = createContext<DailyGateway | null>(null)

/**
 * Hands the UI the gateway of the platform it is running on. The app is mounted inside one by the
 * platform's entry point (`src/electron/renderer/main.tsx`); no component reaches past it.
 */
export function GatewayProvider({ gateway, children }: { gateway: DailyGateway; children: ReactNode }) {
  return <GatewayContext value={gateway}>{children}</GatewayContext>
}

export function useGateway(): DailyGateway {
  const gateway = use(GatewayContext)
  if (gateway === null) throw new Error('The app must be rendered inside a GatewayProvider')
  return gateway
}
