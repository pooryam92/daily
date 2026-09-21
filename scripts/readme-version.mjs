// Keeps the download links in the README on the version in package.json. The installers carry
// their version in the file name, so GitHub's `releases/latest/download/<file>` cannot reach them:
// the README names the release itself, and this rewrites it when the version changes.
//
//   node scripts/readme-version.mjs           rewrite README.md
//   node scripts/readme-version.mjs --check   fail when README.md names another version
//
// `npm version` runs the first (the `version` script in package.json), `npm run check` the second.

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const README = path.join(ROOT, 'README.md')

/**
 * A version counts only behind one of these: the release's tag in a URL, the start of a file name,
 * or the label of the badge. The badge is a static one: shields.io can only read the releases of a
 * public repo, and its live badge shows the new version minutes after the links already do.
 */
const VERSIONED = /(releases\/download\/v|Daily-Setup-|Daily-|daily_|daily-|latest%20release-v)\d+\.\d+\.\d+/g

const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))

// `releases/latest` skips a pre-release, and so does the README: it keeps naming the last stable one.
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.log(`${version} is a pre-release; the README stays on the last stable version.`)
  process.exit(0)
}

const readme = await readFile(README, 'utf8')
if (readme.search(VERSIONED) === -1) {
  console.error('README.md has no versioned download links; has the "Install" section changed?')
  process.exit(1)
}

const updated = readme.replace(VERSIONED, (_, prefix) => `${prefix}${version}`)

if (updated === readme) {
  console.log(`README.md is on ${version}.`)
} else if (process.argv.includes('--check')) {
  console.error(`README.md names another version than package.json (${version}). Run: npm run readme`)
  process.exit(1)
} else {
  await writeFile(README, updated)
  console.log(`README.md now links to ${version}.`)
}
