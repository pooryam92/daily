# Daily — archive

What was built and what was decided, one short entry per feature. It stands on its own: an entry
says what the outcome is and why, and points at code, never at another doc.

When a feature ships, add an entry at the top, so the newest is read first: what it is, the
decisions made, why. Three lines at most.

It replaces two task lists, each with its checks and dead ends: `TASKS.md`, the phased list of
2026-09-19 (`git show 8def090:docs/TASKS.md`), and `release.md`, the checklist to the first release
(`git show 8bd337f:docs/release.md`).

## Dragging onto a row (2026-10-02)

- **Nothing moves while you drag** (`day/useRowDrag.ts`). The row stays in place, dimmed, a small
  copy follows the pointer 16px right and 24px below it (above the finger on touch), and a line or
  a tint shows where it will land. Poorya tried rows that slid aside and a sideways pull past 32px
  to change level, and found them hard to land.
  - Not a row-sized copy: it covers the row being aimed at, and the line.
  - Not a sideways pull: a hidden threshold that fires in ordinary diagonal drags.
  - Not Tab and Shift+Tab for the keyboard: Tab has to keep moving focus (WCAG 2.1.2). → and ←
    during a keyboard drag change the level instead.
- **Every row is a target in three zones** (`day/rowDrag.ts`): the top quarter means above, the
  bottom quarter below, the middle into, so a gap and an "into" both get 18px of a 36px row. A
  step splits at its centre. A zone changes only 2px past its edge, so the line doesn't flicker.
  Thirds are the fallback (`ZONE_EDGE`) if quarters prove tight.
- **The line's indent tells the level:** its dot sits on the box column the row will take. The
  todo the row will belong to is tinted (`--drop-tint`, Poorya's pick), for "into" and for a line
  among its steps.
- **One domain action places a row anywhere** (`placed` in `domain/todo-rules.ts`), anchored to
  the row it goes before, like `reordered`, so it holds when another window changes the list.
- **A todo with steps can't become a step.** Not flattening: it would merge two lists in a way a
  drag can't take back. Its line snaps to the nearest top-level gap. **Settled todos aren't a
  target:** a drop under one would reopen it and pull it from under the pointer.
- **The list scrolls only while the pointer is held past its edge,** never under a resting pointer
  inside it: a list moving under a still pointer changed the place being aimed at.
- **A drag follows only the pointer that started it** (`HeldPointerSensor` in
  `todos/TodoItem.tsx`), and a mouse move with no button held is ignored: dnd-kit 0.5 takes any
  pointer's move or release.
- **"+ Add a step" closes the steps of an unfolded open todo** (Poorya's pick, for the fewest
  bugs): a button that turns into the step editor in place. It is never a drop target.
- **No undo, no sound,** as for reorder: dragging back reverses it.

## Folding steps (2026-10-01)

- **The count is the toggle** (`todos/TodoItem.tsx`): `1/3 ⌄`, and `2/2 ›` when folded, on open
  and done todos. It costs the row no width and needs no hover, so touch has it. A click on the
  count no longer opens the editor; the text does.
  - Not a chevron column before the grip: every row would lose 28px, and more todos wrap at 640×420.
  - Not a chevron at the row's end: it would sit about 380px from its text at 1280.
- **The fold is stored per todo** (`folded?: true` in `domain/todo.ts`, files still `version: 1`),
  the way Apple's outline views remember theirs.
  - Checking a todo folds it, and reopening it leaves the fold.
  - Writing a step, or undoing a step's delete, unfolds it: a step is deleted only while it shows,
    so Undo brings it back into view.
  - Older versions of Daily drop the fold with the steps.
- **No done todo has an open step** (`holding` in `domain/todo-rules.ts`). Unchecking a step,
  restoring an open one, or adding one reopens its done todo. Done flows down, and not-done flows
  up.

## Steps on a todo (2026-10-01)

- **A step is a todo, one level down.** `Todo.steps` is optional, so files stay `version: 1`; the
  depth of one is enforced in `domain/store-schema.ts`, not in the type. Breaking a goal into
  specific steps is the plan that stops it intruding (Masicampo & Baumeister 2011), and each one is
  a small win. Not deeper: Google Tasks, Microsoft To Do and Things stop at one level too.
- **Done flows down, not up** (`toggled` in `domain/todo-rules.ts`): checking a todo checks its
  steps, as Reminders does; every step done leaves the todo open, as Microsoft To Do does, with its
  count in green. Reopening leaves the steps done: nothing records which were open. Not a mixed
  checkbox: that is select-all semantics in WAI-ARIA, not a task's state.
- **The ring and the settling count todos only.** Steps stay where they are when done, and a step
  ticks but never clears the day (`ui/sound/sound.ts`).
- **The one way in is the editor's `step`,** where `delete` lived until 2026-09-25: every app puts
  "add a step" inside the opened task, and the row keeps its two words. Enter chains steps
  (`todos/StepDraft.tsx`); Escape, or leaving an empty one, adds nothing. Not on a done todo: an
  open step under it would undo "done flows down".
- **A count, not a bar:** `1/3` after the last word, inline, in tabular figures; counts read better
  than percentages for a few items. Checking a todo folds it to that one line (see the entry above).
  Its count there is faint, 3.5:1 at 13px, below AA, to match the `delete` word.
- **The box and the words sit with the first line** of a wrapped row, todos and steps alike; before,
  they were centred on the whole text. Found at the 640×420 window, where a long todo with steps
  read as a column with its box adrift.
- **A step drags within its todo only** (its sortable group and type are the todo's id, and its own
  modifiers hold it in the todo's list). Not across todos or to the top level: rows are locked to
  the vertical axis. Nesting by drag came later the same day (see above).

## Drop is gone, delete is back on the row (2026-09-25)

- **Two states.** A todo is open or done; dropped is gone from `domain/todo.ts`, the checkbox,
  the sounds and the row. It was a third answer to a question with two, and the word for it was
  one more button on every row. A todo that will not be done is deleted or moved. A file with
  dropped todos still loads: they read as done (`domain/store-schema.ts`), so the day stays as it
  was.
- **Two words on hover, in two tiers.** The row reads `☐ Buy milk ········ tomorrow   delete`
  (`todos/TodoItem.tsx`). The move word, now plain text without an arrow, says where the todo
  goes; delete, set apart by a gap and the faintest word, says it was a mistake. Left to right they
  are ever more final, so they read as a spectrum, not a menu to compare: choice overload comes
  from options that look like peers, not from their number. At rest a row is its box and its text:
  the words wait for a hover, the past-day rule for the move word included, so the card stays quiet
  (`data-past` is gone from `day/DayCard.tsx`). The editor lost its `delete`.
- **Words, grey, no red.** Icons are only quick when standard
  ([NN/g](https://www.nngroup.com/articles/icon-usability/)), and move has none; a red
  delete would pop out ([Treisman 1980](<https://doi.org/10.1016/0010-0285(80)90005-5>)) on the one
  action least wanted, and it is not irreversible: the toast brings the todo back. Colour marks
  the tier, never danger, and the word carries the meaning (WCAG 1.4.1).
- **Delete or Backspace on the focused text deletes it,** with the same toast.

## Move a todo by hand, and the row read left to right (2026-09-23)

- **The row carries what became of the todo; the todo itself changes through its text.** A row
  reads `☐ Buy milk ········ → tomorrow  drop`. To edit, click the text (`todos/TodoEditor.tsx`); delete
  was in the editor until 2026-09-25. The grip sits left of the checkbox in a slot that is
  always there, so the list never jumps.
- **The checkbox went left.** The left of a page gets 80% of the viewing time
  ([NN/g](https://www.nngroup.com/articles/horizontal-attention-leans-left/)), and a control beside
  its label costs the eye 170–240 ms against about 500 ms at a distance
  ([Penzo 2006](https://www.uxmatters.com/mt/archives/2006/07/label-placement-in-forms.php)). Things
  and TickTick do the same and show a cancelled task as an X in the box. Measured on pages and
  forms, not todo rows. The box stays 28px: a target's size matters more than its distance.
- **Words, not an ✗.** An X means cancel, close or dismiss elsewhere
  ([NN/g](https://www.nngroup.com/articles/cancel-vs-close/)), and labels get used where icons do
  not ([Jensen Harris](https://learn.microsoft.com/en-us/archive/blogs/jensenh/the-importance-of-labels)).
  `drop` is always there because letting go is meant to be used, and a hidden control is used half
  as much ([NN/g](https://www.nngroup.com/articles/hamburger-menus/)). A dropped todo shows its X
  inside the checkbox, in `--dropped`, never red (`todos/DoneCheckbox.tsx`).
- **Delete went into the editor.** On the row it sat on hover beside the most-used control in the
  app, against "avoid placing highly consequential actions directly next to options that are
  benign" ([NN/g](https://www.nngroup.com/articles/proximity-consequential-options/)). It is rare
  and comes back from the toast, so it is a click on the text away; Tab reaches it, and the draft
  is not saved.
- **Move.** `→ tomorrow` on an open todo of today, `→ today` on one of any other day. Giving a
  todo a day is the smallest plan that stops an unfinished task coming to mind
  ([Masicampo & Baumeister 2011](https://users.wfu.edu/masicaej/MasicampoBaumeister2011JPSP.pdf)),
  and nothing moves by itself: a todo that rolls over is a plan nobody made. The todo keeps id, text
  and state, is appended to the target day, and Undo moves it back to the index it had (`moved` in
  `domain/todo-rules.ts`, `todos/useMoveWithUndo.ts`). The deck does not flip.
- **No trace and no count.** "Moved three times" is the overdue badge in another form: a count that
  can only get worse works through loss aversion. A moved todo is a todo of its new day.
- **The word rests on past days only,** where the decision is due; on today and later it appears
  on hover, so today's card stays quiet. Its width is always kept (`data-past`, `DayCard.tsx`).
- **The arrow leads the word and follows the deck,** like the "Back to today" pill: right for
  tomorrow and for today from a past day, left for today from a future one. A moved row slides 24px
  that way as it fades; a deleted one only fades (`ROW_MOVE_X` in `lib/motion.ts`, `LeavingRows` in
  `todos/TodoItem.tsx`).
- **A dropped todo's box** is described as "Dropped" rather than marked partly checked, since a
  dropped todo is not partly done.

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
