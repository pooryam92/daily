# Daily — release tasks

Everything between the current state and a first release that updates itself, in the order we go
through it. Written on 2026-09-20. Cross a task off when it is done and checked; when the list is
empty this file is deleted. The decisions are kept in `architecture.md` (sections 4 to 6) as they
are made, and what the user sees in `features.md`.

Decided so far:

- Packaged with electron-builder, released through GitHub Releases on `pooryam92/daily`.
- The repo becomes public, so the updater can read releases without a token inside the app.
- Windows and Linux (AppImage) update themselves. macOS was left out at first, because nobody here
  runs it and an unsigned macOS app cannot update itself; it came on 2026-09-21 as a build that only
  says when there is an update (2.6).
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
  - A new day is the fresh-start effect the app is built on. The colours follow `design.md`: paper,
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
  - `build/icon.svg` is the source and `build/icon.png` its 1024px export, which the Windows `.ico`
    is generated from.
  - Linux needs the size set in `build/icons/` (16 to 512px, scaled down from the PNG with
    ImageMagick). electron-builder 26 does not generate it: with the big PNG alone the `.deb`
    installed only `hicolor/1024x1024`, a size the icon theme does not list, so no desktop finds it.
- [x] **2.2 Fill in `package.json`: `author` with an email, `description`, `homepage`, and the version from 0.2.**
  - Why: the `.deb` build fails without an author email; the rest shows up in installers and
    About dialogs.
  - Also `repository`, and `desktopName`: Electron uses it as the window's app_id, and with
    `linux.syncDesktopName` the `.desktop` file gets the same name, which is what ties the running
    window to its launcher icon.
- [x] **2.3 Move the renderer libraries to `devDependencies`.**
  - Why: Vite already bundles them. Left in `dependencies`, the packager copies all of
    `node_modules` into the app as well.
  - Checked: the packaged `app.asar` holds `out/` and `electron-updater` with what it needs, nothing
    else. `electron-updater` is the one real dependency, because `tsc` does not bundle the main process.
- [x] **2.4 Add electron-builder and its config: `appId`, product name, files, and the targets.**
  - Targets: Linux AppImage + `.deb` + `.rpm`, Windows NSIS.
  - The `.rpm` came later, for Fedora and openSUSE. It needs `rpmbuild`, which this machine does not
    have (`sudo apt install rpm`); the release workflow installs it. Open: its first build is 6.1.
  - In `electron-builder.yml`, output in `release/`. The NSIS installer keeps its defaults: one
    click, per user, so an update needs no administrator.
- [ ] **2.5 Add `npm run dist`, build on this machine, install the result and use it.**
  - Check: it starts, the todos are the existing ones (1.2), the CSP raises no errors, the icon shows.
  - Checked on the AppImage: it starts, reads `~/.config/daily` (what it loaded equals `todos.json`,
    which stayed byte for byte the same, and `todos.before-v1.0.0.json` appeared), the console has
    no CSP error, and the 404 of the still private repo stays in the log.
  - Open: `sudo apt install ./release/daily_1.0.0_amd64.deb`, then look at the icon in the launcher
    and on the running window. The package was only unpacked and read: `.desktop` entry, the icon
    sizes and `StartupWMClass=daily` are in place. An AppImage has no launcher entry of its own.
  - The Windows installer cannot be built here (it needs Wine); the release workflow builds it (4.2).

- [ ] **2.6 A macOS build: a `.dmg` for Apple silicon and one for Intel.**
  - Added on 2026-09-21, after `v1.0.0`. Signed ad hoc (`identity: '-'`, hardened runtime off):
    there is no Apple developer certificate, and Apple silicon does not start an app with no
    signature at all. The icon is `build/icon-mac.png`, the plate on Apple's grid. The README has
    the Gatekeeper steps.
  - It does not update itself, like the `.deb` (3.3): Squirrel.Mac wants a real signature. No
    code changed for that, because everything that is not Windows or an AppImage already only
    checks. The check reads `latest-mac.yml`, which the `.dmg` build writes.
  - The release workflow builds it on `macos-latest`, both chips on the one runner. The workflow
    can now be started by hand on a branch: it builds everything and releases nothing.
  - Built for the first time by the release run of 2026-09-21 (6.1): both `.dmg` files and
    `latest-mac.yml` are in the release.
  - Open: the first start on a Mac, which needs someone with a Mac: that it opens after
    "Open Anyway", that the todos land in `~/Library/Application Support/daily`, the icon in the
    Dock, and the "Update available" toast (6.2).

## Phase 3 — Updates

- [x] **3.1 Add `electron-updater` to the main process.**
  - Checks at launch and every few hours, because the app stays open for days. Downloads in the
    background, installs on quit. Off in dev. Errors such as being offline stay silent.
  - `src/electron/main/updater.ts`, every four hours. The UI reaches it through a new
    `updates` part of the gateway.
- [x] **3.2 Toast "Update ready" with a Restart button, over a new IPC channel.**
  - The toast stays until it is answered ("Later" or "Restart"): nobody may be looking when the
    update arrives. The main process also keeps the update it found, for a window that opens later.
  - Restart gives up the single-instance lock first (1.1): the updater starts the new AppImage
    before the old app is gone, and the new one would otherwise exit at the lock.
  - Checked without GitHub: a 1.0.0 and a 1.0.1 AppImage built with a `generic` feed on localhost.
    1.0.0 found and downloaded 1.0.1 and showed the toast; Restart replaced the file with
    `Daily-1.0.1.AppImage`, which came up on the same data folder and made its
    `todos.before-v1.0.1.json`. The toast was looked at in both themes. Windows is first seen in 6.2.
- [x] **3.3 `.deb` and `.rpm` installs: a toast that links to the release page instead of downloading.**
  - Why: only the AppImage can replace itself; a `.deb` or `.rpm` is owned by the package manager.
  - electron-updater 6 could install a `.deb` itself, through `pkexec dpkg -i`. Not used: it asks for
    the password when the app quits, and goes around apt.
  - Anything on Linux that is not an AppImage only checks: "Update available", with Download opening
    the latest release. Checked with the unpacked build marked as a `.deb` install: the toast came,
    nothing was downloaded.

## Phase 4 — CI

- [x] **4.1 Workflow that runs `npm run check` on every push and pull request.**
  - `.github/workflows/check.yml`. Checked: the push of the workflow itself ran it, green in 37 s.
- [x] **4.2 Release workflow on a `v*` tag: build on Linux and Windows into a release.**
  - Uses the built-in `GITHUB_TOKEN`; there are no secrets to manage.
  - `.github/workflows/release.yml`. The builds run `npm run dist` and hand their files over as
    workflow artifacts.
  - The installer is now `Daily-Setup-<version>.exe`: GitHub turns spaces in an uploaded file's name
    into dots, while `latest.yml` says dashes, and the updater would get a 404.
  - Checked with the tag `v1.0.0`: the tag check, `npm run check` and both builds passed, 4m14s in
    all. It was the first Windows build. The `.rpm` came after this run; its first build is the next tag.
- [x] **4.3 Publish the release only after both builds succeeded.**
  - Why: a half-filled release gives installed apps a 404 on the update feed.
  - A last job that needs both builds runs `gh release create` with every file, which keeps the
    release a draft until the last upload is done and publishes it then.
  - Checked with `v1.0.0`: the job ran after both builds, and the release came out published with
    all six files: the AppImage, the `.deb`, the `.exe` and its blockmap, `latest-linux.yml` and
    `latest.yml`. A failed build was not tried; `needs: build` is what skips the job then.
- [x] **4.4 Fail the workflow when the tag differs from the `package.json` version.**
  - Why: the updater compares versions from the feed, which comes from `package.json`, not the tag.
  - The first job of the release workflow; nothing is built before it passes.
  - Checked with a throwaway tag `v0.0.0-citest`: the run failed with "The tag is v0.0.0-citest,
    package.json says v1.0.0", and the build and release jobs were skipped. The tag is deleted again.

## Phase 5 — Going public

- [x] **5.1 Read `docs/` once more as a stranger would.**
  - A scan of all eight commits found no secrets; this is only about what you want public.
  - Read on 2026-09-21, all six files and the README: no path, address, account or machine detail
    beyond the name and commit email already accepted in 0.4. Nothing was changed. What a stranger
    does learn: the decisions name Poorya, `archive.md` says the sounds were never heard in "the
    session that built them", and `research.md` marks many rows as unverified. All three were left
    as they are, because they are true.
- [x] **5.2 Apply 0.3: add the license file and the `license` field in `package.json`.**
  - `LICENSE` (MIT, 2026, Poorya), `"license": "MIT"` in `package.json` and the lockfile, and a
    "License" section in the README. `"private": true` stays: it only keeps the package off npm.
- [x] **5.3 Merge `feat/progress-day-cleared` into `main`.**
  - A fast-forward: `main` had nothing the branch lacked, and the history has no merge commits.
    This line is in the last commit that was merged. The tag `v1.0.0` stayed on the branch's
    earlier commit until it was moved (6.1).
- [x] **5.4 README: an install section per platform, including the SmartScreen warning on Windows.**
  - The README is for someone using the app: the demo (`npm run demo`), what it does, install,
    updates, the data. Scripts, structure and packaging moved to `development.md`.
  - "Install": a table of which file is for which system and how it updates, the
    SmartScreen steps, and one command per Linux format. Done before 5.3 so that `main` has it.
  - The `.rpm` file name is what the README says: the release of 2026-09-21 has
    `daily-1.0.0.x86_64.rpm`. Open: the FUSE hint is the general AppImage one, not something met
    here.
- [ ] **5.5 Make the repo public.**

## Phase 6 — First release, and proof that updating works

- [ ] **6.1 Tag and release the first version; install it from the release page.**
  - `v1.0.0` was released twice. The first release (4.2) had no `.rpm`, no macOS build and the old
    README, and nobody else had it, so on 2026-09-21 Poorya had it deleted with its tag, and
    `v1.0.0` tagged again on `main` (`7b0925f`). That run built Linux, Windows and macOS and
    published ten files in 5m40s. The old tag was on `f676337`.
  - Open: installing it from the release page, on Linux and on Windows.
- [ ] **6.2 Release the next patch version and watch the installed app update itself.**
  - Why: the updater cannot be tested in dev. This is the only real test, and it has to pass once
    on Linux and once on Windows. On a Mac, and on a `.deb` install, the test is the "Update
    available" toast.
- [ ] **6.3 Check that `architecture.md` and `features.md` have every decision made here, then delete this file.**
