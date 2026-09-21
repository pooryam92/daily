// Records the demo in the README (docs/media/demo.gif): drives the built UI in headless Chromium
// with a gateway that lives in the page, so no Electron window opens and no real todos are read.
//
//   npm run demo
//
// Needs a Chromium for Playwright (`npx playwright-core install chromium-headless-shell`) and
// `ffmpeg` on the PATH, or its path in FFMPEG. The story is `story()` below; change it there.

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(import.meta.dirname, '..')
const SITE = path.join(ROOT, 'out/electron/renderer')
const OUTPUT = path.join(ROOT, 'docs/media/demo.gif')
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const SIZE = { width: 1920, height: 1080 }
const FPS = 25

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }

/** Serves the built renderer: the page as it ships, CSP included. */
function serve() {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://x')
    const file = path.join(SITE, path.normalize(pathname.endsWith('/') ? `${pathname}index.html` : pathname))
    readFile(file).then(
      (body) => {
        response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
        response.end(body)
      },
      () => {
        response.writeHead(404)
        response.end()
      }
    )
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

/** Runs in the page before the app: the gateway (`window.api`), seeded, and a pointer to film. */
function pageSetup(version) {
  const key = (offset) => {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    const two = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
  }
  const todo = (text, status = 'open') => ({ id: crypto.randomUUID(), text, status })
  let data = {
    version: 1,
    days: {
      [key(-1)]: [
        todo('Book the train to Hamburg', 'done'),
        todo('Reply to Jonas', 'done'),
        todo('Fix the bike light', 'dropped'),
        todo('Read chapter four', 'done')
      ],
      [key(0)]: [todo('Write the release notes'), todo('Water the plants'), todo('Renew the library card')],
      [key(1)]: [todo('Dentist, 9:30')]
    }
  }
  let settings = { theme: 'dark', sound: false }
  const applyTheme = () => {
    if (settings.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = settings.theme
  }
  window.api = {
    todos: {
      load: () => Promise.resolve(data),
      save: (next) => {
        data = next
        return Promise.resolve()
      }
    },
    settings: {
      load: () => Promise.resolve(settings),
      setTheme: (theme) => {
        settings = { ...settings, theme }
        applyTheme()
        return Promise.resolve()
      },
      setSound: (sound) => {
        settings = { ...settings, sound }
        return Promise.resolve()
      }
    },
    app: { version: () => Promise.resolve(version) },
    updates: {
      current: () => Promise.resolve(null),
      subscribe: () => () => undefined,
      restart: () => Promise.resolve(),
      openDownloadPage: () => Promise.resolve()
    }
  }

  // Headless Chromium draws no pointer. The CSP forbids a <style>, not styles set from script.
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme()
    const pointer = document.createElement('div')
    Object.assign(pointer.style, {
      position: 'fixed',
      zIndex: '2147483647',
      left: '0',
      top: '0',
      width: '18px',
      height: '18px',
      margin: '-9px 0 0 -9px',
      borderRadius: '50%',
      background: 'rgb(120 120 120 / 0.35)',
      border: '1.5px solid rgb(255 255 255 / 0.9)',
      boxShadow: '0 0 0 1px rgb(0 0 0 / 0.25)',
      pointerEvents: 'none',
      transition: 'scale 120ms ease-out',
      translate: '-100px -100px'
    })
    document.body.append(pointer)
    document.addEventListener(
      'pointermove',
      (event) => {
        pointer.style.translate = `${String(event.clientX)}px ${String(event.clientY)}px`
      },
      true
    )
    document.addEventListener('pointerdown', () => (pointer.style.scale = '0.7'), true)
    document.addEventListener('pointerup', () => (pointer.style.scale = '1'), true)
  })
}

/** What the demo shows. Every pause is time for the viewer to read what just happened. */
async function story(page) {
  let at = { x: SIZE.width * 0.7, y: SIZE.height * 0.8 }
  const pause = (ms) => page.waitForTimeout(ms)
  /** Moves the pointer to the middle of a control along an eased path, then clicks it. */
  const click = async (locator) => {
    const box = await locator.boundingBox()
    if (box === null) throw new Error(`Nothing to click: ${String(locator)}`)
    const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const steps = 28
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      await page.mouse.move(at.x + (to.x - at.x) * eased, at.y + (to.y - at.y) * eased)
      await pause(14)
    }
    at = to
    await pause(120)
    await page.mouse.down()
    await pause(70)
    await page.mouse.up()
  }
  const add = page.getByLabel('Add a todo').locator('visible=true').first()
  const row = (text) => page.getByRole('listitem').filter({ hasText: text }).locator('visible=true').first()

  await page.mouse.move(at.x, at.y)
  await pause(300)

  // Today is kept brisk, so the other days and the themes get their share of the GIF.
  await add.pressSequentially('Call the landlord', { delay: 45 })
  await pause(100)
  await page.keyboard.press('Enter')
  await pause(300)

  await click(row('Water the plants').getByLabel('Done'))
  await pause(450)
  await click(row('Renew the library card').getByLabel('Dropped'))
  await pause(500)
  await click(row('Write the release notes').getByLabel('Done'))
  await pause(400)
  // The last open todo: the ring closes into a check.
  await click(row('Call the landlord').getByLabel('Done'))
  await pause(1100)

  await click(page.getByLabel('Next day'))
  await pause(900)
  await add.pressSequentially('Pack for the weekend', { delay: 65 })
  await page.keyboard.press('Enter')
  await pause(900)
  await click(page.getByLabel('Previous day'))
  await pause(500)
  await click(page.getByLabel('Previous day'))
  await pause(1300)
  await click(page.getByRole('button', { name: 'Back to today' }))
  await pause(1000)

  await click(page.getByLabel('Settings'))
  await pause(600)
  await click(page.getByRole('radio', { name: 'Light' }))
  await pause(1400)
  await click(page.getByRole('radio', { name: 'Dark' }))
  await pause(700)
  await page.keyboard.press('Escape')
  await pause(1600)
}

/** Films the page through the DevTools screencast: whole frames, each with the time it was drawn. */
async function film(page, directory, run) {
  const session = await page.context().newCDPSession(page)
  const frames = []
  const writes = []
  session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(directory, `${String(frames.length).padStart(5, '0')}.png`)
    frames.push({ file, time: metadata.timestamp })
    writes.push(writeFile(file, Buffer.from(data, 'base64')))
    void session.send('Page.screencastFrameAck', { sessionId })
  })
  await session.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
  await run(page)
  await session.send('Page.stopScreencast')
  await Promise.all(writes)
  return frames
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with ${String(code)}`))
    })
  })
}

/** Frames arrive when the page changes, not on a clock: each is held until the next one. */
async function encode(frames, directory) {
  const last = frames.at(-1)
  if (last === undefined) throw new Error('The screencast produced no frames')
  const list = frames
    .map(({ file, time }, index) => {
      const next = frames[index + 1]
      return `file '${file}'\nduration ${(next === undefined ? 1.5 : next.time - time).toFixed(4)}`
    })
    .concat(`file '${last.file}'`)
    .join('\n')
  const listFile = path.join(directory, 'frames.txt')
  await writeFile(listFile, list)
  await mkdir(path.dirname(OUTPUT), { recursive: true })
  const palette =
    'split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle'
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `fps=${String(FPS)},${palette}`, OUTPUT])
}

const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
const server = await serve()
const directory = await mkdtemp(path.join(tmpdir(), 'daily-demo-'))
const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    viewport: SIZE,
    colorScheme: 'dark',
    reducedMotion: 'no-preference'
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    throw error
  })
  await page.addInitScript(pageSetup, version)
  await page.goto(`http://127.0.0.1:${String(server.address().port)}/`)
  await page.getByLabel('Add a todo').first().waitFor()
  const frames = await film(page, directory, story)
  await encode(frames, directory)
  const { size } = await stat(OUTPUT)
  console.log(
    `${path.relative(ROOT, OUTPUT)}: ${String(frames.length)} frames, ${(size / 1e6).toFixed(1)} MB`
  )
} finally {
  await browser.close()
  server.close()
  await rm(directory, { recursive: true, force: true })
}
