# Daily — UI and design tasks

Every UI/design task that follows from `DESIGN.md` and `UI-RESEARCH.md`, in build order, each with the
reason it exists and the data behind it. Written on 2026-09-19. Phases 0, 1, 2 and 3 are done except
the optional 1.24; nothing from Phase 4 on is implemented yet.

Each **Data** line carries a tag that says how far to trust it:

- **[measured]** — computed from this repo's current CSS on 2026-09-19 (WCAG 2.x contrast formula;
  opacity composited onto the card colour first).
- **[standard]** — a WCAG 2.2 success criterion with a numeric threshold.
- **[strong]** / **[moderate]** — published research, as graded in `DESIGN.md`.
- **[verified]** — read from the linked source in `UI-RESEARCH.md`.
- **[unverified]** — recalled, derived or from a weak source. The task is still reasonable, but the
  numbers in it are a starting point to tune by eye, not a fact.
- **[convention]** — no science; chosen for consistency.

## State before Phase 1, measured

Contrast of the palette that was in `global.css` before Phase 1, against the targets of 4.5:1 for text and 3:1 for
icons and control boundaries (WCAG 1.4.3, 1.4.11):

| What                                            | Light | Dark | Target | Result      |
| ----------------------------------------------- | ----- | ---- | ------ | ----------- |
| Done text, bullet, `delete` (`--muted` on card) | 3.40  | 4.28 | 4.5    | fails both  |
| Dropped text (`--muted` at `opacity: 0.6`)      | 1.95  | 2.43 | 4.5    | fails both  |
| Idle ✓/✗ marks (`--muted` at `opacity: 0.45`)   | 1.63  | 1.93 | 3.0    | fails both  |
| Nav arrows (`--muted` on `--bg`)                | 2.83  | 4.90 | 3.0    | fails light |
| Input boundary (`--border` on card)             | 1.45  | 1.29 | 3.0    | fails both  |
| Error banner (white on `--dropped`)             | 4.47  | 3.06 | 4.5    | fails both  |
| Pressed ✓ (`--done` on card)                    | 3.41  | 7.02 | 3.0    | passes      |
| Todo text (`--text` on card)                    | ~16   | ~13  | 4.5    | passes      |

Six of the eight pairs failed. Phase 1 existed to fix this table; the pairs that replace them are in
the contrast table in `DESIGN.md` §2.

## Phase 0 — Safety net

- [x] **0.1 `git init` and commit the current state.**
  - Why: Phase 1 renames tokens in all six stylesheets at once. Without a baseline there is no diff to
    review and no way back.
  - Data: the folder has a `.gitignore` but no `.git` directory **[measured]**.

## Phase 1 — Foundations

Static look only: no new runtime dependency except the font. Do 1.1 to 1.7 as one change, because 1.1
breaks the old token names until the rest lands.

### Colour

- [x] **1.1 Replace both `:root` blocks in `styles/global.css` with the token block from `DESIGN.md` §7.**
  - Why: every later task references these tokens, and it fixes every failing row in the table above.
  - Data: new pairs measure 5.9 / 5.8 (muted text), 3.5 / 3.5 (faint), 3.2 / 3.4 (input boundary),
    5.7 / 5.7 (banner) against the same targets (`DESIGN.md` §2) **[standard]**.

- [x] **1.2 Rename `--card` → `--surface` and `--muted` → `--text-muted` in every CSS module.**
  - Why: the old names stop existing after 1.1. Seven usages of `--muted`, one of `--card`.
  - Data: grep of `src/renderer/src` **[measured]**.

- [x] **1.3 Dropped stops being red: `--dropped` becomes a neutral (`#57534a` / `#b5b2a9`).**
  - Why: today one red (`#cf4a3c`) means both "I dropped this" and "your change was not saved". Dropping
    is a healthy decision, not a failure.
  - Data: goal disengagement predicts better well-being (Wrosch et al. 2003) **[strong]**; an explicit
    plan closes the mental loop like finishing does (Masicampo & Baumeister 2011) **[moderate]**; red as
    a failure cue impairs performance (Elliot et al. 2007) **[moderate, mixed replications]**; ~8% of men
    cannot tell red from green, and green-vs-neutral survives every common deficiency **[strong]**.

- [x] **1.4 Error banner in `App.module.css`: `background: var(--danger-solid)`, `color: var(--on-danger)`.**
  - Why: it currently borrows `--dropped` and a hard-coded `#fff`; after 1.3 it would turn grey.
  - Data: 4.47 light / 3.06 dark today, 5.7 / 5.7 after **[measured]** / **[standard]** 1.4.3.

- [x] **1.5 `TodoItem.module.css`: real colours instead of `opacity`.** Done text `--text-muted`; dropped
      text `--text-faint` with no `opacity: 0.6`; idle marks and the bullet `--text-faint` with no
      `opacity: 0.45`; `.remove:hover` → `--danger`.
  - Why: opacity on top of a muted colour gives a different, unmeasured result per theme. That is how
    dropped text ended up at 1.95:1.
  - Data: 1.95 / 2.43 and 1.63 / 1.93 today **[measured]**; done items should stay readable because
    visible small wins are the strongest day-to-day motivator (Amabile & Kramer 2011, ~12,000 diary
    entries) **[moderate]**.

- [x] **1.6 Only the "Today" label is accent-coloured.** Add `data-today` to the card; `.relative` uses
      `--accent` when the day is today, else `--text-muted`.
  - Why: right now Yesterday, Today and Tomorrow are all blue, so none of them is the landmark.
  - Data: the one item that differs is the one noticed (von Restorff 1933) **[strong]**; the new day as a
    temporal landmark is the premise of the app (Dai, Milkman & Riis 2014) **[strong]**.

- [x] **1.7 Nav arrows use `--text-muted`; input border uses `--border-strong`.**
  - Why: both are controls and both are nearly invisible in light mode.
  - Data: arrows 2.83:1, input boundary 1.45:1 / 1.29:1 today, target 3:1 **[measured]** /
    **[standard]** 1.4.11.

### Typography

- [x] **1.8 Install `@fontsource-variable/inter` and import it in `global.css`; set `--font-sans`.**
  - Why: `system-ui` on Linux is whatever the distro ships, so the app looks different per machine. The
    title also asks for `font-weight: 650`, which does not exist in a static font and rounds to 700.
  - Data: x-height, not point size, drives legibility (Legge & Bigelow 2011) **[strong]**; harder-to-read
    instructions are judged harder to do (Song & Schwarz 2008) **[moderate]**. Package 5.3.0, OFL-1.1,
    local files so it works offline **[verified]**.

- [x] **1.9 Body text 15px/1.4 → 16px/1.5; title 22px → 24px / 1.2 / `-0.01em`; four sizes only.**
  - Why: todo text is the content of the app and 15px sits exactly on the fluency threshold.
  - Data: Inter's x-height at 60 cm subtends 0.207° at 15px and 0.221° at 16px; the threshold is ~0.2°
    (Legge & Bigelow 2011) **[measured]** / **[strong]**. Line-height 1.5 matches WCAG 1.4.12
    **[standard]**.

- [x] **1.10 Inter details: `font-feature-settings: 'liga' 1, 'calt' 1`, `font-optical-sizing: auto`,
      antialiased smoothing, `tnum` on counts and dates, `text-wrap: balance` on the title and `pretty`
      on todo text.**
  - Why: free polish that ships in Chromium 152; tabular numerals stop "3 of 5" from jittering later.
  - Data: rsms.me/inter, Rauno Freiberg's guidelines, Chrome docs **[verified]**.

- [x] **1.11 Never change font weight to show todo state** (keep it as a rule; marks already use weight,
      text must not).
  - Why: a weight change reflows the line, so the list shimmers when a todo is toggled.
  - Data: **[convention]**.

### Space, shape, measure

- [x] **1.12 Add the spacing and radius tokens and snap stray values to the 4px grid.**
  - Why: consistency; component CSS should only reference tokens.
  - Data: strays found today: `5px` and `6px` (TodoItem), `9px` (input), `6px 14px` (banner, back to
    today), `padding-bottom: 5px` (nav) **[measured]**. The grid itself is **[convention]**.

- [x] **1.13 Decide `--card-max`: 960px → 720px.** If yes, the nav-arrow offset `590px` in
      `DayStack.module.css` becomes `470px`. Decided: 720px, as `DESIGN.md` recommends. The offset is now
      derived from `--card-max` (half the card + 112px), so the two can no longer drift apart.
  - Why: shorter lines, and the ✓/✗ marks sit closer to the text they act on.
  - Data: reading comfort drops past ~100 characters per line; 960px at 16px allows ~105 (Dyson 2004)
    **[moderate]**; shorter pointer travel is faster (Fitts 1954) **[strong]**.

- [x] **1.14 Keep ✓/✗ at 28×28px or larger and nav arrows at 48×48px.** A guard, not a change.
  - Data: WCAG 2.5.8 minimum is 24×24px **[standard]**.

### Accessibility

- [x] **1.15 Handle `prefers-reduced-motion`.** Keep opacity and colour changes (~200 ms), drop
      transforms.
  - Why: the sliding, scaling card stack is exactly the motion that triggers vestibular discomfort, and
    nothing handles it today. Cheap now, awkward to retrofit once springs exist.
  - Data: WCAG 2.3.3 **[standard]**; MDN / web.dev guidance **[verified]**.

- [x] **1.16 Real focus rings.** Add `--focus-ring` and apply it as `box-shadow` on `:focus-visible` for
      every interactive element; the auto-focused input gets the quieter accent border plus a 1px ring.
  - Why: the input sets `outline: none` and signals focus with a 1px border-colour change only.
  - Data: WCAG 2.4.7 **[standard]**; Vercel and Rauno guidelines **[verified]**.

- [x] **1.17 Gate the hover-revealed `delete` behind `@media (hover: hover) and (pointer: fine)`.**
  - Why: on a touch screen the action is otherwise undiscoverable.
  - Data: Vercel design guidelines **[verified]**.

### Surfaces and scrolling

- [x] **1.18 Layered, background-tinted shadow on the front card; fewer layers on peeking cards.**
  - Why: a single `0 10px 30px` blur reads as a flat grey halo; stacked shadows read as real depth. Still
    one elevation level, so it does not contradict `DESIGN.md`.
  - Data: Tobias Ahlin's six-layer recipe, Josh Comeau on tinting and one light source, Vercel's "two
    layers plus a translucent border" **[verified]**. Inner highlight and paper-grain values
    **[unverified]**.

- [x] **1.19 Dark theme: warm neutrals, elevation by lighter surface.**
  - Why: the current dark palette switches to cool blue-greys (`#17171a`, `#232328`), so the app has two
    identities. Pure black/white pairs are avoided in both themes.
  - Data: max-contrast pairs cause halation, especially light-on-black with astigmatism **[moderate]**;
    lighter-surface elevation is Material's dark-theme concept **[verified]**; one identity across
    themes is **[convention]**.

- [x] **1.20 Scroll fades and scrollbar on `.todos`.** Scroll-driven mask that appears only when the list
      overflows; `scrollbar-width: thin`, `scrollbar-gutter: stable`, `overscroll-behavior: contain`.
  - Why: a long day currently cuts off hard at the input, and the default scrollbar is the least
    designed thing on the card. No smooth-scroll library: it fights trackpad inertia.
  - Data: css-tricks scroll-driven shadows and Chrome scrollbar docs (Chrome 121+ standard properties
    override `::-webkit-scrollbar`) **[verified]**; `overscroll-behavior` benefit **[unverified]**.

- [x] **1.21 Desktop chrome details.** `cursor: default` on non-text chrome; todo text stays selectable
      (already true); solid borders and no grain under `prefers-contrast: more`.
  - Data: Lotus "making Electron feel native" **[verified]**; the `prefers-contrast` part **[unverified]**.

### Window (`src/main/window.ts`)

- [x] **1.22 No white flash on launch.** `show: false`, `win.show()` on `ready-to-show`, `backgroundColor`
      from `nativeTheme.shouldUseDarkColors`.
  - Why: it is the first thing seen on every launch, and the flash is brightest in dark mode.
  - Data: Electron docs / Lotus write-up **[verified]**; none of the three is set today **[measured]**.

- [x] **1.23 Remember window size and position** with `windowStatePersistence: true` and a unique `name`.
  - Why: the window opens at 1000×700 every time. Zero dependencies.
  - Data: present in the installed Electron 44 `electron.d.ts`, marked experimental **[verified]**;
    `electron-window-state` was last published in 2018 **[verified]**.

- [ ] **1.24 Decide on a hidden title bar** (`titleBarStyle: 'hidden'` + `titleBarOverlay`, drag region on
      the card header). Stay opaque on Linux.
  - Why: removes the last piece of stock chrome. Optional, and the riskiest window change.
  - Data: transparent windows are not resizable and misbehave on Wayland **[verified]**.
  - Status: still open. Left out of the Phase 1 change because it is a taste call and the only window
    change that can break dragging and resizing.

## Decisions

`UI-RESEARCH.md` §7 lists where the two docs disagree. These are taste calls; Phases 3 and 4 depend on
them. D1, D2 and D5 were decided with Poorya on 2026-09-19.

- [x] **D1 Sound: off by default,** with a one-click toggle. 4.5 gets built but ships muted.
  - Data: the more frequent the action, the quieter the sound should be (Google Material)
    **[verified]**; Superlist had to add an off toggle **[verified]**; no evidence either way on the
    default **[unverified]**.
- [x] **D2 Progress: a ring only, no "3 of 5".** 4.1 loses the count and `@number-flow/react`.
  - Data: for a ring, the goal-gradient effect (Hull 1932) **[verified]**. Against a count, `DESIGN.md`
    says no counters, and completion bias means volume should not be the headline (Gino & Staats)
    **[verified]**. A ring shows how close the day is without saying how much was done.
- [ ] **D3 Easing curve.** `cubic-bezier(0.2, 0, 0, 1)` or `cubic-bezier(0.23, 1, 0.32, 1)`. Open on
      purpose: it is picked by feel on the card flip, which is 3.2. Phase 2 uses the existing
      `--ease-out`; it is one token plus `EASE_OUT` in `lib/motion.ts`, so switching is cheap.
- [ ] **D4 Serif for the date header** (Instrument Serif, Newsreader). Open: Poorya picks from a
      side-by-side with Inter in both themes. Pure taste **[unverified]**; the fluency argument only
      covers todo text.
- [x] **D5 Confetti for rare milestones: skip.** Both docs agree per-item feedback stays small.

## Phase 2 — The completion moment

- [x] **2.1 Install `motion` (13.4.0, MIT).**
  - Why: springs, layout animation, enter/exit, SVG path drawing and drag in one dependency. Hand-rolled
    animation is ruled out for this project.
  - Data: up to 47 kB gzip, less with LazyMotion; React 19 in its peer range **[verified]**.

- [x] **2.2 Rebuild ✓ as an accessible animated checkbox.** Hidden native `<input type="checkbox">` inside
      a `<label>`, `aria-hidden` SVG on top; fill ~120 ms, then draw the check with `pathLength` 0 → 1 over
      ~180 ms; reverse the order on uncheck.
  - Why: this is the app's one per-item reward moment, and today it is an instant colour swap on a text
    glyph.
  - Data: feedback under ~100 ms reads as instant and the whole flourish must end inside 400 ms (Miller
    1968; Doherty & Thadani 1982) **[strong]**; technique from tomdohnal.com and Motion docs
    **[verified]**; the exact 120/180 ms split **[unverified]**.

- [x] **2.3 Animated strike-through.** Pseudo-element with `scaleX(0 → 1)`, `transform-origin: left`, or a
      `background-size` gradient for multi-line todos; ~200 ms.
  - Why: `text-decoration` cannot be transitioned, so today the line just appears.
  - Data: technique **[verified]** (lesser-known source); animate only `transform` and `opacity`
    (Vercel) **[verified]**.

- [x] **2.4 Calm ✗.** Cross-fade to the muted ✗ over ~150 ms; no path draw, no scale.
  - Why: dropping signals release, not achievement, so it gets no reward animation and no error tone.
  - Data: reasoned from 1.3 and the frequency rule **[unverified]**.

- [x] **2.5 Resolved rows settle to the bottom after 600–800 ms** with a layout animation.
  - Why: open todos rise to the top so what is left is what pops; the delay lets a mis-click be undone
    before the row moves.
  - Data: Things 3 keeps completed items visible and dimmed **[verified]**; the delay value
    **[unverified]**. Needs a sort rule in `lib/todos.ts`, with tests.

- [x] **2.6 New todos animate in.** Opacity plus `translateY(-8px → 0)`, 200 ms, skipped when items are
      added in quick succession.
  - Data: entry scale/opacity ranges from Emil Kowalski **[verified]**; this exact recipe **[unverified]**.

- [x] **2.7 Delete becomes an undo toast (`sonner` 2.0.8).** Remove the "danger" framing from `delete`.
  - Why: an undo window is safer and faster than a confirm dialog, and delete is currently irreversible.
  - Data: "undo with a safe window instead of confirm" (Vercel, Rauno) **[verified]**; 9.4 kB gzip
    **[verified]**.

- [x] **2.8 Everything interruptible.** Rapid checks, an uncheck mid-animation or a day flip never wait on
      an animation. Use springs/transitions, not keyframes.
  - Data: Rauno Freiberg; Apple HIG (weakly) **[verified]**.

- [x] **2.9 Press feedback on buttons:** scale 0.97, 100–160 ms; never `ease-in`, never `transition: all`.
  - Data: Emil Kowalski's standards **[verified]**.

Notes from building Phase 2:

- The checkbox stays where the ✓ was, on the right next to ✗, as an 18px rounded square in a 28px
  target. `--surface` on `--done` measures 4.7 / 7.1 for the check **[measured]**.
- 2.3 uses the `background-size` variant, because todos do wrap; forced colours fall back to
  `text-decoration`.
- 2.5 settles after 700ms of quiet, in both directions: a reopened row waits the same time before it
  goes back up. The rule is `displayOrder` in `lib/todos.ts`; the delay is `useSettledTodos`.
- 2.6 also scrolls a new row into view, since it is no longer always the last one in the list.
- 2.7: the toast sits bottom centre, lifted above the add-todo input, inverted (`--text` as its
  background) so it needs no new colour. Undo window 6s **[unverified]**.
- 2.9 is plain CSS (`:active` plus the `scale` property), which is what Emil Kowalski's standard
  describes. The 28px marks use 0.92, since 0.97 of 28px is under a pixel **[unverified]**.
- **CSP.** Sonner and Motion's `popLayout` each add a `<style>` element at runtime, which the built
  page's `style-src 'self'` blocks. `vite.config.mts` now allows exactly those two blocks by hash
  instead of `'unsafe-inline'` **[measured]**: without it the toast was unstyled in `npm start`.

## Phase 2.5 — Settings (added 2026-09-19, asked for by Poorya)

- [x] **S.1 Theme: Auto / Light / Dark.** A quiet gear button in the window's bottom-left corner opens a
      popover with a three-way segmented control. Placement chosen by Poorya over a card-header icon and
      a right-click menu.
  - Why a popover and not a button that cycles: Auto and Light look identical while the OS is light, so
    a cycle cannot show which one is active.
  - How: the main process sets `nativeTheme.themeSource`, which flips `prefers-color-scheme` for the
    page, so no stylesheet (and not the Sonner toast either) knows about the setting. It is stored in
    `settings.json` next to `todos.json` and applied before the window is created, so there is no
    flash of the wrong theme **[measured]**: relaunch comes up in the saved theme.
  - Libraries: `@base-ui/react` 1.8.0 (Popover, RadioGroup; its `CSPProvider` turns off
    Base UI's inline style elements because of the strict CSP) and `lucide-react` 1.47.0 for the icons. This
    pulls the first use of 5.2 and 5.5 forward. The sliding pill is a Motion `layoutId`.
  - The sound toggle (4.5, D1) goes into the same popover.

## Phase 3 — The day deck

- [x] **3.1 Motion budget by frequency.** Arrow-key flips instant or ~150 ms with `bounce: 0`; click and
      drag flips get the full spring.
  - Why: the current CSS gives every flip the same `0.3s ease`, including held-down arrow keys.
  - Data: "never animate keyboard-initiated actions"; 100+ uses a day get no animation (Emil Kowalski);
    "delight increases as feature usage decreases" (Benji Taylor) **[verified]**.

- [x] **3.2 Spring card flips** replacing `transition: transform 0.3s ease`. Start at
      `{ type: 'spring', duration: 0.5, bounce: 0 }`, ~0.15 bounce only after a drag release.
  - Why: springs carry velocity, so a flip can be retargeted mid-flight instead of restarting.
  - Data: Emil's default and Apple WWDC18 session 803 (damping 1.0, response 0.4) **[verified]**; the
    stiffness 250 / damping 31 conversion **[unverified]**. Card travel must stay under 400 ms
    **[strong]**.

- [x] **3.3 Drag to change day.** Commit only on release; commit past a distance threshold or at velocity
      above 0.11 px/ms; rubber-band at the limits; ~10 px hysteresis before locking the axis; pointer
      capture.
  - Data: Sonner's threshold, Emil's apple-design skill formulas **[verified]**; interior.dev's 92 px /
    520 px/s values **[verified]**, lesser-known source.

- [x] **3.4 Trackpad two-finger swipe (`wheel-gestures` 2.3.0).** One flip per gesture; ignore momentum
      tails; require `|deltaX| > |deltaY| × 1.3` so vertical list scrolling never flips the deck.
  - Why: Chromium does not expose a momentum phase, so a naive deltaX accumulator flips several days per
    swipe.
  - Data: Motion's carousel write-up **[verified]**; threshold values from individual write-ups
    **[unverified]** as best practice.

- [x] **3.5 Deck layout on large windows** (was "Tune deck depth"; done first, 2026-09-19, because the
      springs of 3.2 animate these positions). Card height capped at 860px; extra width shows more of ±1
      (56 → 240px); depth is a tint towards `--bg` instead of opacity; cards behind show a stand-in in
      their visible strip: a date tab and one wordless bar per todo, the same on both sides. (The 64px
      slivers of ±2 and ±3 it first had were removed on 2026-09-20: only ±1 show.)
  - Why: a 1920×1080 window was a 720×1040 sheet with ~520px of empty background per side
    **[measured]**.
  - Data: Poorya picked it from five layouts built side by side; the values are by eye
    **[unverified]**. Reasoning in `DESIGN.md`, "The deck on large windows".
  - The stand-in exists because the real content is covered unevenly (the day after showed only its
    checkboxes). Bars and not text: a readable list pulled attention off today; Poorya rejected it.

- [x] **3.6 Performance guard.** Animate only `transform` and `opacity`; animate the full `transform`
      string in Motion if frames drop; blur under 20 px.
  - Data: Vercel guidelines, Emil's repo **[verified]**.

Notes from building Phase 3 (2026-09-20):

- **One value moves the deck.** `useDeckView` holds `view`, the day the deck is looking at as a
  continuous number. Every card derives its transform, opacity, z-index, tint, lift and which of its
  two layouts shows from its distance to `view` (`lib/deck.ts`, `DayCard.tsx`). A key, a click, a drag
  and a swipe all just move `view`, so nothing can get out of step and any of them can interrupt any
  other. CSS no longer positions or transitions the cards.
- 3.1: a tap of an arrow key is a spring with response 0.15s (at rest in ~160ms); a held key
  (`event.repeat`) is instant; a click, the arrow buttons and a swipe get response 0.35s.
- 3.2: the springs are given as stiffness and damping, not as `duration`/`bounce`. Motion starts a
  duration-based spring from rest on purpose ("time-defined springs should ignore inherited
  velocity", `motion-dom` `spring.mjs`) **[measured]**, which would defeat the reason for 3.2.
  Response 0.35s with damping ratio 1 is stiffness 322 / damping 36: 95% there in ~260ms, at rest
  inside 400ms **[measured]** in the running app. 0.35 instead of the 0.4 of WWDC18 because 0.4 is at
  rest just past 400ms; tune by eye **[unverified]**. A released drag uses damping ratio 0.85 (the
  "~0.15 bounce").
- 3.3: the card in front stays under the pointer: one day of drag is the distance that card travels
  (the peek plus 4% of its width, 84–269px depending on the window). A release flips past half a day,
  which is also where the two cards swap depth, so the card on top at release is the one that wins,
  or at more than 0.11 px/ms; a flick back against the drag cancels. One day per drag; past that the
  deck rubber-bands (the 0.55 curve, at most half a day more). With a mouse a drag cannot start on
  todo text, which stays selectable; with touch it can. Focus returns to the input after a drag
  that goes back. In a narrow window half a day is only ~42px of drag: tune by eye **[unverified]**.
- 3.4: a swipe flips once it has travelled 90px and is 1.3× more sideways than vertical; nothing more
  until `wheel-gestures` reports a new gesture, and never from its momentum tail.
- 3.6: from frame to frame only `transform` (one string) and `opacity` change. The tint towards
  `--bg` and the front card's deeper shadow became two layers that fade (`.shade`, `.lift`; the
  shadow token is split into `--shadow-peek` + `--shadow-lift`), replacing transitions of
  `background-color` and `box-shadow`. `will-change` is set only while the deck moves
  (`data-moving`, `data-dragging`), so text at rest is rendered as before.
- Cards at ±2 and ±3 are mounted but invisible, so a day is in place before a flip or an overdrawn
  drag shows it. The view never trails the day in front by more than one day: "Back to today" from
  far away arrives as a single flip from the right side, not a flight through every day between.
- Under `prefers-reduced-motion` every flip is instant (no fade either: the fades now follow the
  position); a drag still follows the hand, because that movement is the user's own.
- Checked by driving the built Electron app and, for the drags, the same renderer in headless
  Chromium (a real pointer on the desktop disturbs synthetic drags) **[measured]**. Not checked: a
  real trackpad. The swipe was driven with synthetic wheel events, which have no momentum tail.

## Phase 4 — Progress and day cleared

- [ ] **4.1 Header progress ring (16 px), no count (D2),** animated with `stroke-dashoffset`. Dropped
      todos advance the ring too.
  - Why: effort rises as the goal gets closer, and counting drops keeps the progress honest.
  - Data: goal-gradient effect **[verified]**; never fake progress (endowed progress, Nunes & Drèze:
    34% vs 19% redemption) **[verified]**; ring design itself **[unverified]**.

- [ ] **4.2 Small ring or dot on the visible edge of peeking cards.**
  - Data: modelled on the Things 3 progress pie **[verified]**; our design **[unverified]**.

- [ ] **4.3 Day-cleared moment.** The ring closes and morphs into a check once, the header line changes,
      then the card rests. Opacity cross-fade only under reduced motion.
  - Why: people judge an experience by its peak and its end; this is the app's only peak.
  - Data: peak-end rule (NN/g) **[verified]**; "a big action needs a big wind-up", reserved for rare
    moments ((Not Boring)) **[verified]**.

- [ ] **4.4 Empty-state copy.** Tell the user where they stand; no guilt copy on empty or unfinished days;
      keep wording stable and change only the part that differs.
  - Data: NN/g empty states, Family's copy rule **[verified]**; fresh start effect **[strong]**.

- [ ] **4.5 Sound.** Soft tick per completion with pitch rising on consecutive checks, warmer chime for
      day cleared, lower soft sound for ✗, one-click mute. Plain Web Audio, CC0 samples (Kenney).
  - Data: Clear's rising scale **[verified]**; sound pleasantness drives emotional response (Springer 2011) **[verified]**; `use-sound` and `howler` are semi-maintained, so no library **[verified]**.

## Phase 5 — Later

- [ ] **5.1 Reorder todos** with `@dnd-kit/react` 0.5.0, exact version pinned. Data: still 0.x
      **[verified]**; dragging onto another day **[unverified]**.
- [ ] **5.2 Right-click menu and tooltips** with `@base-ui/react` 1.8.0. Data: unstyled, fits CSS Modules
      **[verified]**; component coverage **[unverified]**.
- [ ] **5.3 Keyboard shortcuts** with `tinykeys` 4.0.0 (1 kB). Data: **[verified]**.
- [ ] **5.4 Command palette** with `cmdk` 1.1.1. Data: stable but quiet since 2025-03 **[verified]**.
- [ ] **5.5 Icons** from `lucide-react` to replace the `‹ › ✓ ✗` text glyphs. Why: glyph shape and weight
      depend on the fallback font. Data: per-icon imports **[verified]**.

## Never build

Guard rails from `DESIGN.md` §9 and `UI-RESEARCH.md` §1. Each would undercut the fresh-start premise.

- **Overdue or rollover indicators.** Fresh start effect (Dai et al. 2014) **[strong]**.
- **Streaks, karma, completion percentages as a headline.** Streaks work through loss aversion and
  produce documented anxiety; Todoist had to add a Vacation mode **[verified]**. Badly designed rewards
  undermine intrinsic motivation (self-determination theory) **[verified]**.
- **Priority colours, tags, labels.** Every added choice slows every decision (Hick 1952) **[strong]**.
- **Per-item confetti or variable rewards that pull the user back.** Manipulation matrix **[verified]**.
- **Libraries on the avoid list:** `@use-gesture/react`, `use-sound`, `howler`, `vaul`,
  `electron-window-state`, `keen-slider`, `gsap`, `lenis`, `@dnd-kit/core`, `lottie-react` — see
  `UI-RESEARCH.md` §6 for the reason per package.

## Definition of done, per phase

- `npm run check` passes.
- Checked by eye in both light and dark themes, and once with `prefers-reduced-motion: reduce`.
- Any new colour pair is measured and added to the contrast table in `DESIGN.md`.
