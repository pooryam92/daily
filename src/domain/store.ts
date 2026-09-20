import type { DaysMap } from './todo'

export const STORE_VERSION = 1

/** Everything the app keeps: the one document a gateway loads and saves. */
export interface StoreData {
  readonly version: typeof STORE_VERSION
  readonly days: DaysMap
}

export const EMPTY_STORE: StoreData = { version: STORE_VERSION, days: {} }
