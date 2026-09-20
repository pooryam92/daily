# Daily — release tasks

Everything between the current state and a first release that updates itself, in the order we go
through it. Written on 2026-09-20. Cross a task off when it is done and checked; when the list is
empty, the decisions go into `ARCHIVE.md` and this file is deleted.

Decided so far:

- Packaged with electron-builder, released through GitHub Releases on `pooryam92/daily`.
- The repo becomes public, so the updater can read releases without a token inside the app.
- Windows and Linux (AppImage) update themselves. There is no macOS build: nobody here runs it,
  and unsigned macOS apps cannot update themselves. It can be added to the build matrix later.
- The first version is `1.0.0`, as `package.json` already says.
- The commit email stays as it is; history is not rewritten.

## Phase 0 — Decisions

- [x] **0.1 Which platforms are used day to day.** Linux and Windows.
  - Why: only the Linux build can be tried on this machine. A platform nobody runs is built but
    never tested.
- [x] **0.2 First version number: keep `1.0.0` or start at `0.1.0`.** Keep `1.0.0`.
  - Why: the first tag has to match `package.json`, and the updater only ever moves upward.
- [x] **0.3 License: MIT, another one, or none.** MIT.
  - Why: the standard choice for a small open project. It allows commercial use by others, which
    was weighed against PolyForm Noncommercial and accepted: for a personal todo app the risk is
    close to zero.
- [x] **0.4 Commit email: keep it or rewrite history to the GitHub noreply address.** Keep it.
  - Why: every commit carries it and it becomes public with the repo.
- [x] **0.5 The icon: who makes it, and what it shows.** A sun on the horizon, paper on blue.
  - Why: there is no icon in the repo. Without one every platform shows the default Electron icon.
  - A new day is the fresh-start effect the app is built on. The colours follow `DESIGN.md`: paper,
    and the one blue that marks "Today". No green and no check, because green means done.

## Phase 1 — The app, before it is installed anywhere

- [x] **1.1 Single-instance lock: a second launch focuses the open window and exits.**
  - Checked: with one instance running, a second launch on the same data folder exited with code 0
    in 0.3 s and the first kept running.
  - Why: each instance holds the whole store in memory and rewrites the whole file, so two running
    copies silently overwrite each other's todos. A launcher icon makes a double launch easy.
- [x] **1.2 Pin the user-data folder to `~/.config/daily` (and its equivalents).**
  - Why: the folder name follows the app name. Setting the product name to "Daily" can move it to
    `~/.config/Daily`, and the installed app would open empty.
  - A build run from the repo uses `~/.config/daily-dev` instead: with 1.1 it could not run next to
    the installed app otherwise, and development would write to the real todos. The current todos
    and settings were copied there once. `--user-data-dir` still overrides both.
  - Checked for the repo build: lock and session data land in `daily-dev`, the real folder is not
    touched. The installed half is checked in 2.5.
- [x] **1.3 Back up `todos.json` when the app version changes.**
  - Why: after the first release, real data lives on installed machines. `parseStoreData` does not
    migrate and drops fields it does not know, so a bad update could lose data with no way back.
  - The first start of a version copies the file to `todos.before-v<version>.json`, never
    overwrites one, and keeps the newest five. Checked against a scratch folder.
- [x] **1.4 Show the app version in the settings menu.**
  - Why: the only way to tell which build is running, and whether an update went through.
  - The gateway gained `app.version()`. Checked in both themes on the production build, and end to
    end through Electron's IPC.

## Phase 2 — Packaging

- [x] **2.1 Add the icon (one 1024px PNG under `build/`).**
  - `build/icon.svg` is the source and `build/icon.png` its 1024px export. The `.ico` and the Linux
    size set are generated from the PNG by electron-builder.
- [ ] **2.2 Fill in `package.json`: `author` with an email, `description`, `homepage`, and the version from 0.2.**
  - Why: the `.deb` build fails without an author email; the rest shows up in installers and
    About dialogs.
- [ ] **2.3 Move the renderer libraries to `devDependencies`.**
  - Why: Vite already bundles them. Left in `dependencies`, the packager copies all of
    `node_modules` into the app as well.
- [ ] **2.4 Add electron-builder and its config: `appId`, product name, files, and the targets.**
  - Targets: Linux AppImage + `.deb`, Windows NSIS.
- [ ] **2.5 Add `npm run dist`, build on this machine, install the result and use it.**
  - Check: it starts, the todos are the existing ones (1.2), the CSP raises no errors, the icon shows.

## Phase 3 — Updates

- [ ] **3.1 Add `electron-updater` to the main process.**
  - Checks at launch and every few hours, because the app stays open for days. Downloads in the
    background, installs on quit. Off in dev. Errors such as being offline stay silent.
- [ ] **3.2 Toast "Update ready" with a Restart button, over a new IPC channel.**
- [ ] **3.3 `.deb` installs: a toast that links to the release page instead of downloading.**
  - Why: only the AppImage can replace itself; a `.deb` is owned by the package manager.

## Phase 4 — CI

- [ ] **4.1 Workflow that runs `npm run check` on every push and pull request.**
- [ ] **4.2 Release workflow on a `v*` tag: build on Linux and Windows into a draft release.**
  - Uses the built-in `GITHUB_TOKEN`; there are no secrets to manage.
- [ ] **4.3 Publish the draft only after both builds succeeded.**
  - Why: a half-filled release gives installed apps a 404 on the update feed.
- [ ] **4.4 Fail the workflow when the tag differs from the `package.json` version.**
  - Why: the updater compares versions from the feed, which comes from `package.json`, not the tag.

## Phase 5 — Going public

- [ ] **5.1 Read `docs/` once more as a stranger would.**
  - A scan of all eight commits found no secrets; this is only about what you want public.
- [ ] **5.2 Apply 0.3: add the license file and the `license` field in `package.json`.**
- [ ] **5.3 Merge `feat/progress-day-cleared` into `main`.**
- [ ] **5.4 README: an install section per platform, including the SmartScreen warning on Windows.**
- [ ] **5.5 Make the repo public.**

## Phase 6 — First release, and proof that updating works

- [ ] **6.1 Tag and release the first version; install it from the release page.**
- [ ] **6.2 Release the next patch version and watch the installed app update itself.**
  - Why: the updater cannot be tested in dev. This is the only real test, and it has to pass once
    on Linux and once on Windows.
- [ ] **6.3 Move the decisions into `ARCHIVE.md` and delete this file.**
