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

Changes to `src/main` or `src/preload` need a restart of `npm run dev`; the renderer hot-reloads.

## Structure

```
src/
  shared/      Types and validation used by every process
    todo.ts            domain types: Todo, DayKey, StoreData
    ipc.ts             the IPC contract between renderer and main
    store-schema.ts    runtime validation of persisted / received data
  main/        Electron main process (Node)
    index.ts           app lifecycle
    window.ts          the window and its security settings
    ipc.ts             typed IPC handlers
    todo-store.ts      the JSON file the todos live in
  preload/     Bridge that exposes `window.api` to the renderer
  renderer/    The React UI (browser)
    src/lib/           pure logic: dates, todo reducer — unit tested
    src/hooks/         state: today, day navigation, the todo store, settings, sounds
    src/components/    DayStack > DayCard > TodoItem / AddTodoForm, each with its CSS module
    src/styles/        design tokens and global styles
```

Rules of thumb:

- Logic that doesn't need React goes in `lib/` as pure functions, with tests.
- Hooks own state and side effects; components only render and call actions.
- The renderer never touches Node or the file system. It talks to the main process through the
  typed contract in `shared/ipc.ts`, and the main process validates everything it receives.
- The preload script is sandboxed, so it may only import _types_ from `shared/`.

## Data

Todos are stored in `todos.json` in Electron's user-data folder (`~/.config/daily/` on Linux).
A file that can't be read is moved aside as `todos.json.corrupt-<timestamp>` rather than overwritten.
