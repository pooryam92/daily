/// <reference types="vite/client" />

declare global {
  /** Defined by the build (vite.config.mts): authorizes dnd-kit's injected styles under the CSP. */
  const __STYLE_NONCE__: string
}

export {}
