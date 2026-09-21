// CHANGELOG.md is a Keep a Changelog file: changes are written under "Unreleased" with the change
// itself, and a release gives that section its version and date.
//
//   node scripts/changelog.mjs                   turn "Unreleased" into the package.json version
//   node scripts/changelog.mjs --check           fail when there is nothing under "Unreleased"
//   node scripts/changelog.mjs --notes <version> print that version's section
//
// `npm version` runs the second before it touches package.json (`preversion`) and the first after
// (`version`). The release workflow runs the third: the section is the text of the GitHub release.

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')
const REPO = 'https://github.com/pooryam92/daily'

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

/** The lines under a version's heading, up to the next version or the link list at the end. */
function section(changelog, version) {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## [') || /^\[[^\]]+\]: /.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
}

const changelog = await readFile(CHANGELOG, 'utf8')

const notes = process.argv.indexOf('--notes')
if (notes !== -1) {
  const version = (process.argv[notes + 1] ?? '').replace(/^v/, '')
  const text = section(changelog, version)
  if (!text) fail(`CHANGELOG.md has no section for ${version}, or an empty one.`)
  console.log(text)
  process.exit(0)
}

// A release nobody can describe is not one: the text under "Unreleased" becomes the release notes.
if (!section(changelog, 'Unreleased')) fail('CHANGELOG.md has nothing under "Unreleased" to release.')
if (process.argv.includes('--check')) process.exit(0)

const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
if (section(changelog, version) !== null) fail(`CHANGELOG.md already has a section for ${version}.`)

const previous = /^\[unreleased\]: .*\/compare\/v(.+)\.\.\.HEAD$/m.exec(changelog)?.[1]
if (previous === undefined) fail('CHANGELOG.md has no "[unreleased]: …/compare/v<version>...HEAD" link.')

const today = new Date()
const date = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
  .map((part) => String(part).padStart(2, '0'))
  .join('-')

const updated = changelog
  .replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${version}] - ${date}\n`)
  .replace(
    /^\[unreleased\]: .*$/m,
    `[unreleased]: ${REPO}/compare/v${version}...HEAD\n[${version}]: ${REPO}/compare/v${previous}...v${version}`
  )

await writeFile(CHANGELOG, updated)
console.log(`CHANGELOG.md: "Unreleased" is now ${version} (${date}).`)
