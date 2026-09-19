import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// Dev needs inline scripts and a websocket for HMR, so the CSP is only added to the built page.
const contentSecurityPolicy: Plugin = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; script-src 'self'"
      },
      injectTo: 'head-prepend'
    }
  ]
}

export default defineConfig({
  root: 'src/renderer',
  // Relative asset paths so the built page works over file://
  base: './',
  plugins: [react(), contentSecurityPolicy],
  resolve: {
    alias: { '@shared': path.resolve(import.meta.dirname, 'src/shared') }
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'out/renderer'),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
