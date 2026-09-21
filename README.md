# Daily

A small Electron todo app with one card per day. Every day starts empty; todos are open, done (✓) or dropped (✗).

Click a todo's text to edit it. Enter or clicking away saves; Escape cancels.
Drag its bullet/grip to reorder within the open or resolved part of the day.
With the grip focused, Space/Enter picks up and drops, arrow keys move, and Escape cancels.

## Scripts

| Command          | What it does                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `npm run dev`    | Run the app against the Vite dev server (hot reload)              |
| `npm start`      | Build everything and run the built app                            |
| `npm run build`  | Compile main + preload with `tsc`, bundle the renderer            |
| `npm run dist`   | Build, then package for this platform into `release/`             |
| `npm run check`  | Type-check, lint, test and check formatting — run before a commit |
| `npm test`       | Unit tests (Vitest)                                               |
| `npm run lint`   | ESLint (type-aware)                                               |
| `npm run format` | Prettier                                                          |

Changes to `src/electron/main` or `src/electron/preload` need a restart of `npm run dev`; the UI hot-reloads.

## Structure

Three parts, joined by one interface. `domain/` is the pure core and imports nothing, `ui/` is the
React app and knows the domain and the gateway interface in `ports.ts`, and only `electron/` knows
it is Electron. A web build would add `src/web/` next to `src/electron/` with its own entry and
gateway, and reuse `domain/`, `ports.ts` and `ui/` unchanged.

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

## Docs

| File                                         | What is in it                                                        |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [docs/features.md](docs/features.md)         | What the app does, feature by feature                                |
| [docs/architecture.md](docs/architecture.md) | How it is built: structure, IPC, security, data, packaging, updates  |
| [docs/design.md](docs/design.md)             | Colour, type, space and motion, with the evidence behind each choice |
| [docs/archive.md](docs/archive.md)           | What was built and decided, one short entry per feature              |
| [docs/research.md](docs/research.md)         | Facts and their sources; no conclusions                              |
| [docs/release.md](docs/release.md)           | The checklist to the first release; deleted when it is done          |

File names in `docs/` are lowercase.

## Packaging and updates

`npm run dist` packages with electron-builder (`electron-builder.yml`): an AppImage and a `.deb` on
Linux, an NSIS installer on Windows. It never uploads anything. The renderer's libraries are
`devDependencies` because Vite bundles them; only what the main process loads at runtime
(`electron-updater`) is a `dependency`, and only that is copied into the app.

A release is made by pushing a `v<version>` tag that matches `package.json`: the release workflow
runs the check, builds on Linux and Windows, and publishes the GitHub release once both are done.

The installed app looks for a newer GitHub release at launch and every four hours. An AppImage and a
Windows install download it in the background, show "Update ready" with a Restart button, and
install it when the app quits either way. A `.deb` belongs to the package manager, so there the app
only says "Update available" and opens the release page. A build run from the repo never checks.

## Data

Todos are stored in `todos.json` in Electron's user-data folder: `~/.config/daily/` on Linux for the
installed app, and `~/.config/daily-dev/` for a build run from this repo, so development never touches
the real todos. Only one instance runs per folder; a second launch focuses the first.

A file that can't be read is moved aside as `todos.json.corrupt-<timestamp>` rather than overwritten.
The first start of each new version copies the file to `todos.before-v<version>.json`; the newest
five are kept.
