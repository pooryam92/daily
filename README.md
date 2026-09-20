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
| `npm run check`  | Type-check, lint, test and check formatting — run before a commit |
| `npm test`       | Unit tests (Vitest)                                               |
| `npm run lint`   | ESLint (type-aware)                                               |
| `npm run format` | Prettier                                                          |

Changes to `src/electron/main` or `src/electron/preload` need a restart of `npm run dev`; the UI hot-reloads.

## Structure

The layers point inwards: `domain` knows nothing about anything else, `ui` knows the domain and the
gateway interface, and only `electron/` knows it is Electron. A web build would add `src/web/` next
to `src/electron/` with its own entry and gateway, and reuse `domain/`, `application/` and `ui/`
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
  application/
    ports.ts           DailyGateway: everything the UI needs from its platform
  ui/          The React app. Platform-agnostic: it only ever talks to the gateway.
    gateway.tsx        the context the gateway is handed in through
    lib/               browser-side helpers: deck geometry, sound synthesis, wording
    hooks/             state: today, day navigation, the todo store, settings, sounds
    components/        DayStack > DayCard > TodoItem / AddTodoForm, each with its CSS module
    styles/            design tokens and global styles
  electron/    This platform: the gateway implemented over IPC.
    ipc-contract.ts    the channels between renderer and main
    main/              app lifecycle, the window, IPC handlers, the JSON files
    preload/           exposes the gateway to the renderer as `window.api`
    renderer/          index.html and the entry that mounts `ui/` with that gateway
```

Rules of thumb:

- Logic that doesn't need React or a platform goes in `domain/` as pure functions, with tests.
- Hooks own state and side effects; components only render and call actions.
- The UI never touches Node, the file system or `window.api`. It calls the gateway it was given,
  and the main process validates everything it receives.
- The preload script is sandboxed, so every import but `electron` must be _type-only_.

## Data

Todos are stored in `todos.json` in Electron's user-data folder (`~/.config/daily/` on Linux).
A file that can't be read is moved aside as `todos.json.corrupt-<timestamp>` rather than overwritten.
