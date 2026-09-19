import path from 'node:path'

/** Set by `npm run dev`: load the renderer from the Vite dev server instead of the built files. */
export const DEV_SERVER_URL = process.argv.includes('--dev') ? 'http://localhost:5173' : null

// This file is compiled to out/main/, next to out/preload/ and out/renderer/.
export const PRELOAD_PATH = path.join(__dirname, '../preload/index.js')
export const RENDERER_HTML_PATH = path.join(__dirname, '../renderer/index.html')
