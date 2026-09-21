# Daily — archive

What was built and what was decided, one short entry per feature. It stands on its own: an entry
says what the outcome is and why, and points at code, never at another doc.

When a feature ships, add an entry: what it is, the decisions made, why. Three lines at most.

It replaces two task lists, each with its checks and dead ends: `TASKS.md`, the phased list of
2026-09-19 (`git show 8def090:docs/TASKS.md`), and `release.md`, the checklist to the first release
(`git show 8bd337f:docs/release.md`).

## Foundations (2026-09-19)

- **Colour tokens.** One token block in `global.css`. Text pairs measure 4.5:1 or more and
  controls 3:1 or more, in both themes. A state gets a real colour, never `opacity` on a
  muted colour: that is how dropped text had ended up at 1.95:1.
- **Dropped is neutral, not red.** Dropping is a healthy decision, not a failure. Red (`--danger`)
  only means "your change was not saved".
- **Only "Today" is accent-coloured,** so it is the landmark among the day labels.
- **Inter, bundled** (`@fontsource-variable/inter`): the same look on every machine, and offline.
  Body 16px/1.5, title 24px, four sizes only. Font weight never shows todo state, because a weight
  change reflows the line and the list shimmers.
- **4px grid; `--card-max` 720px** (was 960px, ~105 characters per line). The nav-arrow offset is
  derived from `--card-max`, so the two cannot drift apart.
- **Accessibility.** `prefers-reduced-motion` keeps fades and drops transforms. `--focus-ring` on
  every `:focus-visible`. The hover-revealed `delete` is gated behind
  `(hover: hover) and (pointer: fine)`. Marks stay 28px or larger, nav arrows 48px. Solid borders
  and no grain under `prefers-contrast: more`.
- **Surfaces.** A layered, tinted shadow at one elevation level. The dark theme is warm neutrals
  with elevation by lighter surface; no pure black or white in either theme. The list has a
  scroll-driven fade and a thin scrollbar; no smooth-scroll library, because it fights trackpad
  inertia.
- **Window.** No white flash (`show: false` until `ready-to-show`, themed `backgroundColor`). Size
  and position come from Electron's own `windowStatePersistence` (experimental), not
  `electron-window-state` (last published in 2018).

## The completion moment (2026-09-19)

- **`motion` is the one animation dependency;** nothing is hand-rolled. Everything is interruptible:
  springs and transitions, never keyframes.
- **Checkbox.** A hidden native checkbox in a `<label>` with an SVG on top: fill ~120ms, then the
  check draws in ~180ms, all inside 400ms. It stays on the right, next to ✗.
- **Strike-through** animates with `background-size`, because todos wrap and `text-decoration`
  cannot be transitioned. Forced colours fall back to `text-decoration`.
- **✗ is calm:** a 150ms cross-fade and no reward animation. Dropping is release, not achievement.
- **Settling.** A resolved row moves below the open ones after 700ms of quiet, and a reopened row
  waits the same before it goes back up, so a mis-click can be undone first. The rule is
  `displayOrder` in `domain/todo-rules.ts`; the delay is `useSettledTodos`.
- **New rows** fade and slide in, and scroll into view.
- **Delete is an undo toast** (`sonner`, 6s), not a confirm dialog. It sits bottom centre above the
  input, in inverted colours so it needs no new token.
- **Press feedback** is plain CSS: scale 0.97, and 0.92 on the 28px marks.
- **CSP.** Sonner and Motion's `popLayout` add a `<style>` element at runtime. `vite.config.mts`
  allows exactly those two by hash instead of `'unsafe-inline'`. A new library that injects styles
  needs the same treatment, or it is unstyled in `npm start`.

## Settings (2026-09-19)

- **A gear in the bottom-left corner opens a popover** (`@base-ui/react`, with its `CSPProvider`
  because of the strict CSP; `lucide-react` icons). Poorya chose this placement over a card-header
  icon and a right-click menu.
- **Theme is a three-way control, Auto / Light / Dark,** not a button that cycles: Auto and Light
  look identical while the OS is light. The main process sets `nativeTheme.themeSource`, so no
  stylesheet knows about the setting. It is saved in `settings.json` and applied before the window
  exists, so there is no flash of the wrong theme.
- **Sound is a second field in `settings.json`,** off by default, set over its own validated IPC
  channel. `useSettings` is owned by `App`, because the deck needs the setting too.

## The day deck (2026-09-19 and 2026-09-20)

- **One value moves the deck.** `useDeckView` holds `view`, a continuous day number. Every card
  derives its transform, opacity, tint and layout from its distance to `view` (`deck/deck.ts`). A
  key, a click, a drag and a swipe all just move `view`, so any of them can interrupt any other.
  CSS no longer positions the cards.
- **Motion budget by frequency.** A held arrow key is instant, a tapped one is a 0.15s spring, and
  a click, the arrow buttons and a swipe get 0.35s.
- **Springs are given as stiffness and damping** (322 / 36), not `duration`/`bounce`: Motion starts
  a duration-based spring from rest, which throws away the velocity that springs were chosen for.
  A flip is at rest inside 400ms. A released drag uses damping ratio 0.85.
- **Drag.** The front card stays under the pointer. A release flips past half a day or above
  0.11 px/ms; a flick back cancels. One day per drag, with a rubber band beyond that. A mouse drag
  cannot start on todo text, which stays selectable.
- **Trackpad swipe** (`wheel-gestures`). One flip per gesture after 90px, only when the movement is
  1.3× more sideways than vertical, and never from the momentum tail.
- **Large windows.** Card height is capped at 860px and extra width shows more of ±1 (56 → 240px).
  Depth is a tint towards `--bg`, not opacity. Poorya picked this from five layouts built side by
  side. Only ±1 are visible; ±2 and ±3 are mounted but invisible, so a day is in place before a
  flip shows it.
- **Cards behind show a stand-in:** a date tab and one wordless bar per todo. Poorya rejected
  readable text there, because it pulled attention off today.
- **Performance.** Only `transform` (as one string) and `opacity` change per frame. The tint and
  the deeper shadow are two layers that fade (`.shade`, `.lift`). `will-change` is set only while
  the deck moves.
- **"Back to today" from far away is a single flip,** not a flight through every day between.
  Under reduced motion a flip is instant, but a drag still follows the hand.

## Progress and the cleared day (2026-09-20)

- **D1. Sound is off by default,** with a one-click switch in Settings.
- **D2. A progress ring only, no "3 of 5".** Volume should not be the headline. The ring is a
  `progressbar` whose value text is "3 of 5 resolved", so a screen reader gets what the eye gets.
- **D5. No confetti.** Per-item feedback stays small.
- **Ring.** 16px, after the day's label, and 12px on the tab of a card behind. Dropped todos count
  as progress; a day without todos has no ring and is not cleared (`dayProgress` in
  `domain/todo-rules.ts`).
- **Cleared.** The ring closes and morphs into a check, and the word "Cleared" appears in a live
  region. This happens once per clearing: a cleared day that comes into view gets no flourish.
  Deleting the last open todo clears the day quietly. The timings are `CLEARED` in
  `lib/motion.ts`.
- **Copy.** "Nothing planned for today / tomorrow / yesterday / this day" (`day/copy.ts`). An
  unfinished day gets no words: no guilt copy.
- **The sounds are synthesised in `sound/sound.ts`, not samples.** They could not be chosen by ear in
  the session that built them; numbers beat files picked blind, the rising scale is exact and
  there is no asset to license. Swapping in samples later only touches `play()`.

## Reorder, edit, icons (2026-09-20)

- **Reorder** with `@dnd-kit/react`, pinned to an exact version because it is still 0.x. Rows move
  within a day's open group or its settled group. Drag the grip, or focus it and use Space/Enter,
  the arrow keys, then Space/Enter; Escape cancels. The order is saved to disk, and settling
  pauses during a drag.
- **Inline edit.** Click a todo's text or activate it from the keyboard. Enter or blur saves,
  Escape cancels, a blank edit keeps the original text, and the status is kept.
- **Icons** are `lucide-react` (chevrons, the drop mark, grips), because a text glyph's shape
  depends on the fallback font. The check stays a hand-made SVG path for its fill-then-draw
  animation.

## Packaging, the first release and updates (2026-09-20 and 2026-09-21)

- **The icon** is a sun on the horizon, paper on the one blue of "Today": a new day is the fresh
  start the app is built on. No green and no check, because green means done. `build/icon.svg` is
  the source; Linux gets a size set (`build/icons/`), macOS its own PNG on Apple's grid.
- **One running app, one data folder.** A second launch focuses the open window and exits: every
  instance rewrites the whole file. The folder is pinned to `daily` (`daily-dev` from the repo),
  so the packaged name "Daily" cannot move it. Each new version first copies `todos.json` aside.
- **The app's version** is at the bottom of the settings popover: the only way to tell which build
  runs, and whether an update went through.
- **Packaged with electron-builder** (`electron-builder.yml`): AppImage, `.deb` and `.rpm`, an NSIS
  installer, a `.dmg` per Mac chip. Only `out/` goes into the app. Nothing is signed, because a
  certificate is a yearly cost; macOS is signed ad hoc, which Apple silicon needs to start it at all.
- **Updates come from GitHub Releases** (`electron/main/updater.ts`): at launch and every four
  hours. Windows and the AppImage replace themselves and say "Update ready"; the `.deb`, the `.rpm`
  and macOS only say "Update available" and open the release page. The toast stays until answered.
- **A `v*` tag makes the release** (`.github/workflows/release.yml`): it fails when the tag is not
  the `package.json` version, runs the check, builds on three systems, and one last job publishes,
  so a release never lacks a platform. Started by hand, it builds and releases nothing.
- **A release is `npm version patch` and `git push --follow-tags`.** The installers carry their
  version in the file name, so `scripts/readme-version.mjs` puts the README's download links and
  badge on the new version in the same commit, and `npm run check` fails when they differ.
- **`CHANGELOG.md` follows Keep a Changelog.** "Unreleased" is filled with each change, stamped
  with version and date by `scripts/changelog.mjs` in the release commit, and its section is the
  text of the GitHub release. An empty "Unreleased" stops `npm version`.
- **MIT, and the first version is `1.0.0`:** the updater only moves upward. `v1.0.0` was released
  three times before anyone had installed it, each time deleted with its tag and tagged again: the
  first lacked the `.rpm` and the macOS build, the second the changelog as the text of the release.
- **Checked:** the AppImage and the `.deb` on this machine (todos kept, icon in the launcher, no
  CSP error); self-update from 1.0.0 to 1.0.1 with two AppImages and a feed on localhost; the
  "Update available" path with a build marked as a `.deb`; the tag check with a throwaway tag.

## Left open

- A hidden title bar (`titleBarStyle: 'hidden'`). A taste call, and the riskiest window change:
  it can break dragging and resizing. Stay opaque on Linux either way.
- D3, the easing curve: `cubic-bezier(0.2, 0, 0, 1)` or `cubic-bezier(0.23, 1, 0.32, 1)`. It is one
  token plus `EASE_OUT` in `lib/motion.ts`.
- D4, a serif for the date header (Instrument Serif, Newsreader). Poorya picks from a side-by-side
  with Inter in both themes.
- A right-click menu and tooltips (`@base-ui/react`), keyboard shortcuts (`tinykeys`) and a command
  palette (`cmdk`).
- Never checked, of the release: an update from one GitHub release to the next, on the AppImage
  and on Windows (the only real test of the updater; first chance is `v1.0.1`); installing from
  the release page on Windows; the first start on a Mac (that "Open Anyway" is enough, the data
  folder, the icon in the Dock, the toast). The FUSE hint in the README is the general AppImage
  one, not something met here. The repo was private when this was written: the README's download
  links and the update feed answer only once it is public.
- Never checked: how the sounds sound, and a real trackpad (the swipe was driven with synthetic
  wheel events, which have no momentum tail). To tune by eye: the 0.35s spring, the drag threshold
  in a narrow window (~42px), the 6s undo window and the `CLEARED` timings.

## Never build

Each would undercut the fresh-start premise of the app.

- **Overdue or rollover indicators.** Yesterday's open todos stay on yesterday's card.
- **Streaks, karma, completion percentages as a headline.** Streaks work through loss aversion,
  which is what the daily reset exists to avoid.
- **Priority colours, tags, labels.** Every added choice slows every decision.
- **Per-item confetti, or variable rewards that pull the user back.**
- **Libraries.** Unmaintained: `@use-gesture/react`, `use-sound`, `howler`, `vaul`,
  `electron-window-state`, `keen-slider`. Superseded: `@dnd-kit/core` (by `@dnd-kit/react`),
  `@base-ui-components/react` (by `@base-ui/react`). Wrong for this app: `gsap` (licence,
  imperative), `lenis` (smooth scrolling on a desktop), `lottie-react` (196 kB).
