import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const sha256 = (content: string): string =>
  `'sha256-${createHash('sha256').update(content).digest('base64')}'`

// dnd-kit injects runtime styles; authorize its injector without allowing arbitrary inline styles.
const styleNonce = randomBytes(16).toString('base64')

/**
 * Two libraries add a `<style>` element at runtime, which `style-src 'self'` blocks. Instead of
 * opening the policy up with 'unsafe-inline', exactly those two style blocks are allowed by hash:
 * - Motion (`AnimatePresence mode="popLayout"`) adds an empty one and fills it through the CSSOM.
 * - Sonner adds its stylesheet when it is imported. The hash is taken from the installed package,
 *   so it follows Sonner updates; if Sonner ever stops doing this, the build fails here.
 */
function inlineStyleHashes(): string {
  const sonner = readFileSync(createRequire(import.meta.url).resolve('sonner'), 'utf8')
  const injected = /__insertCSS\(("(?:[^"\\]|\\.)*")\)/.exec(sonner)?.[1]
  if (injected === undefined) throw new Error('Could not find the stylesheet Sonner injects; update the CSP.')
  return [sha256(''), sha256(JSON.parse(injected) as string)].join(' ')
}

// Dev needs inline scripts and a websocket for HMR, so the CSP is only added to the built page.
const contentSecurityPolicy: Plugin = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: `default-src 'self'; script-src 'self'; style-src 'self' ${inlineStyleHashes()} 'nonce-${styleNonce}'`
      },
      injectTo: 'head-prepend'
    }
  ]
}

export default defineConfig({
  root: 'src/electron/renderer',
  // Relative asset paths so the built page works over file://
  base: './',
  define: { __STYLE_NONCE__: JSON.stringify(styleNonce) },
  plugins: [react(), contentSecurityPolicy],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') }
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'out/electron/renderer'),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
