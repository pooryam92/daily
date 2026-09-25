# Daily — development

How to run, change, check and release the app. This file says how to do things; why the app is built
the way it is, is in `architecture.md`, and each section here names the section there that has the
reasons.

Keep it current: a new script, a moved folder or a changed release step changes this file in the
same commit.

## Scripts

| Command          | What it does                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `npm run dev`    | Run the app against the Vite dev server (hot reload)              |
| `npm start`      | Build everything and run the built app                            |
| `npm run build`  | Compile main + preload with `tsc`, bundle the renderer            |
| `npm run dist`   | Build, then package for this platform into `release/`             |
| `npm run demo`   | Build, then record `docs/media/demo.gif` again (see "The demo")   |
| `npm run readme` | Put the README's download links on the `package.json` version     |
| `npm run check`  | Type-check, lint, test and check formatting — run before a commit |
| `npm test`       | Unit tests (Vitest)                                               |
| `npm run e2e`    | Build, then drive the built app end to end (Playwright)           |
| `npm run lint`   | ESLint (type-aware)                                               |
| `npm run format` | Prettier                                                          |

Changes to `src/electron/main` or `src/electron/preload` need a restart of `npm run dev`; the UI hot-reloads.

Node 24 and `npm install` are all it needs.

`npm run dev` has no CSP, because hot reload needs inline scripts. A library that adds styles at
runtime therefore looks fine there and comes up unstyled in `npm start`, where the strict CSP
applies. Check such a change in the built app (`architecture.md`, section 3).

## Structure

Three parts, joined by one interface (the reasons are in `architecture.md`, section 1). `domain/` is
the pure core and imports nothing, `ui/` is the React app and knows the domain and the gateway
interface in `ports.ts`, and only `electron/` knows it is Electron. A web build would add `src/web/`
next to `src/electron/` with its own entry and gateway, and reuse `domain/`, `ports.ts` and `ui/`
unchanged.

```
src/
  domain/      The app itself: types, rules and validation. No React, no Node, no Electron.
    todo.ts            Todo, TodoStatus, DayKey, DaysMap
    todo-rules.ts      createTodo, the days reducer, display order, progress
    dates.ts           day-key maths and formatting
    store.ts           StoreData: the document that is loaded and saved
    store-schema.ts    runtime validation of persisted / received data
    settings.ts        Settings, ThemeMode
    settings-schema.ts runtime validation of the settings file
  ports.ts     DailyGateway: everything the UI needs from its platform.
  ui/          The React app, grouped by feature. It only ever talks to the gateway.
    App.tsx            wires the features together
    gateway.tsx        the context the gateway is handed in through
    deck/              the stack of days and moving through it: DayStack, drag, swipe, geometry
    day/               one day's card: DayCard, ProgressRing, today's date, wording
    todos/             TodoItem, TodoEditor, AddTodoForm, DoneCheckbox, the todo store, undo
    settings/          SettingsMenu and the settings state
    sound/             sound synthesis and when it plays
    updates/           the update notice and the app's version
    lib/               shared by every feature: motion tokens, error messages
    styles/            design tokens and global styles
  electron/    This platform: the gateway implemented over IPC.
    ipc-contract.ts    the channels between renderer and main
    main/              app lifecycle, the window, IPC handlers, the JSON files, the updater
    preload/           exposes the gateway to the renderer as `window.api`
    renderer/          index.html and the entry that mounts `ui/` with that gateway
```

Rules of thumb:

- Logic that doesn't need React or a platform goes in `domain/` as pure functions, with tests.
- Hooks own state and side effects; components only render and call actions.
- In `ui/`, a file lives in the folder of its feature, next to its CSS module and its test. Only
  what every feature uses goes in `ui/lib/`.
- The UI never touches Node, the file system or `window.api`. It calls the gateway it was given,
  and the main process validates everything it receives.
- The preload script is sandboxed, so every import but `electron` must be _type-only_.
- Something new the UI needs from the platform is a method on `DailyGateway` in `ports.ts`, a channel
  in `electron/ipc-contract.ts`, and a handler in `electron/main/` that validates its arguments.

ESLint enforces the import direction, so a wrong import fails `npm run check`.

Outside `src/`: `build/` holds the icons, `e2e/` the end-to-end tests, `scripts/` the demo recorder and what `npm version` runs, `electron-builder.yml` the
packaging, and `.github/workflows/` the check and the release.

## Checking a change

`npm run check` is the gate: types, lint, tests and formatting. Run it before a commit;
`.github/workflows/check.yml` runs it on every push and pull request.

A unit test sits next to its file. The domain and the pure parts of `ui/` have them. Components and
the main process are not unit-tested with mocks; `e2e/` drives the built app instead, with the real
main process, IPC and CSP (`architecture.md`, section 7). `npm run e2e` builds and runs it; the
workflow runs it after the check, under `xvfb-run` because Electron needs a display. Each test
launches the app with a temporary data folder, which it may seed with todos through `test.use`, and
reads the JSON files back to check what was saved. Neither the real todos nor `daily-dev/` are
touched.

## Data while developing

A build run from the repo keeps its files in `~/.config/daily-dev/`, the installed app in
`~/.config/daily/`, so development never touches the real todos and both can run at once. On Windows
the two are `%APPDATA%\daily-dev\` and `%APPDATA%\daily\`, on macOS `daily-dev/` and `daily/` in
`~/Library/Application Support/`. `--user-data-dir=<folder>` wins over both.
Only one instance runs per folder; a second launch focuses the first.

## Packaging and releasing

`npm run dist` packages with electron-builder (`electron-builder.yml`): an AppImage, a `.deb` and an
`.rpm` on Linux, an NSIS installer on Windows, a `.dmg` per chip on macOS, in `release/`. The `.rpm`
needs `rpmbuild` (`sudo apt install rpm`). It never uploads anything. The renderer's libraries are
`devDependencies` because Vite bundles them; only what the main process loads at runtime
(`electron-updater`) is a `dependency`, and only that is copied into the app. The reasons are in
`architecture.md`, section 5.

A release is two commands, on a clean working tree:

```sh
npm version patch        # or minor, major
git push --follow-tags
```

`npm version` first fails when `CHANGELOG.md` has nothing under "Unreleased". Then it sets the
version in `package.json`, gives "Unreleased" that version and today's date
(`scripts/changelog.mjs`), puts the README's download links on it (`scripts/readme-version.mjs`),
and makes one commit, "chore: release v<version>" (`.npmrc`), with
the tag `v<version>` on it. The installers carry their version in the file name, so the README has
to name the release; `npm run check` fails when it names another version than `package.json`, which
is what catches a version set by hand. For the minutes the workflow takes, the links on `main` point
at a release that is not there yet.

The release workflow (`.github/workflows/release.yml`) does the rest. It fails at once when the tag
is not the `package.json` version. Then it runs the check, builds on Linux, Windows and macOS, and
publishes the GitHub release once all three builds are done. The text of the release is the
version's section of `CHANGELOG.md`.

The same workflow can be started by hand on any branch (Actions → Release → Run workflow, or
`gh workflow run release.yml --ref <branch>`). It then builds all three platforms, releases nothing
and keeps the installers as workflow artifacts for a day. That is how to try a platform this
machine cannot build.

A build run from the repo never looks for updates. How the installed app does is in
`architecture.md`, section 6.

## Docs

File names in `docs/` are lowercase, and diagrams are Mermaid. A change to what the user can do
changes `features.md` in the same commit, and a technical decision goes into `architecture.md`. A new
file gets a row in the README's "Docs" table.

`CHANGELOG.md` in the root is a [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) file. A
change that someone using the app would notice gets a line under "Unreleased" in the same commit,
under "Added", "Changed", "Deprecated", "Removed", "Fixed" or "Security", written for that person
and not for a developer. A refactor, a doc or a CI change gets none.

## The demo

The animation at the top of the README is recorded by `scripts/record-demo.mjs`, not by hand, so it
can be made again whenever the app looks different: `npm run demo`.

- It serves the built renderer, opens it in headless Chromium (`playwright-core`) and hands it a
  gateway that lives in the page, seeded with three days of todos. No Electron window opens and no
  real todos are read. This is the same seam a web build would use (`architecture.md`, section 1).
- The story is the `story()` function: what is typed and clicked, and how long each result is held.
  A pointer is drawn by the script, because headless Chromium has none.
- Frames come from the DevTools screencast, each with the time it was drawn, and `ffmpeg` turns them
  into a GIF with its own palette. A GIF, because GitHub only plays a video that was uploaded
  through its web editor, and an image in the repo needs no hand.
- It needs two things that `npm install` does not bring: a Chromium for Playwright
  (`npx playwright-core install chromium-headless-shell`) and `ffmpeg` on the PATH, or its path in
  `FFMPEG`.
- The window is 1920×1080 and the theme dark; both are constants at the top of the script.
