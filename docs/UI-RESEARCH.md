# Daily — interaction and feel research

Research done on 2026-09-19 into how Daily should feel: the psychology of finishing a task, the
craft of motion and surfaces, and which libraries to build it with. `DESIGN.md` covers the static
foundations (colour, type, spacing tokens); this file covers interaction, motion, sound, scrolling
and dependencies. Section 7 lists where the two documents disagree.

Nothing here is implemented yet. Every claim carries one of two tags:

- **[verified]** — the value or statement was read from the linked source, or from `npm view` on
  2026-09-19.
- **[unverified]** — recalled from memory, derived by us, taken from a lesser-known source, or the
  page could not be opened. Check before relying on it.

## 1. The psychology of finishing a task

| Principle                                 | What it says                                                                                                                        | What it means for Daily                                                                                        | Source                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Doherty threshold                         | Under 400 ms, neither the person nor the computer waits on the other **[verified]**                                                 | The check registers on the same frame; the whole flourish ends within about 300 ms                             | https://lawsofux.com/doherty-threshold/                                                                                                                                  |
| Progress principle (Amabile)              | Small visible wins are the strongest driver of a good inner work life; based on about 12,000 diary entries **[verified]**           | Done todos stay on the card, dimmed and struck through. The card is the record of the day                      | https://www.library.hbs.edu/working-knowledge/how-small-wins-unleash-creativity                                                                                          |
| Zeigarnik and Ovsiankina effects          | Open tasks keep intruding on attention **[verified]**                                                                               | Give every todo a way to be closed: done, dropped, or moved                                                    | https://lawsofux.com/zeigarnik-effect/ · https://en.wikipedia.org/wiki/Ovsiankina_effect                                                                                 |
| Plan-making (Masicampo & Baumeister 2011) | Making a plan removes the intrusive thoughts from an unfulfilled goal **[verified]**                                                | An explicit drop closes the loop just like finishing does. Drop is a calm outcome, never an error              | https://users.wfu.edu/masicaej/MasicampoBaumeister2011JPSP.pdf                                                                                                           |
| Self-determination theory                 | Supporting autonomy and competence builds intrinsic motivation; badly designed rewards undermine it **[verified]**                  | No points, no karma. The user decides what counts                                                              | https://selfdeterminationtheory.org/wp-content/uploads/2020/10/2018_RutledgeWalshEtAl_Gamification.pdf                                                                   |
| Goal-gradient effect (Hull 1932)          | Effort rises as the goal gets closer **[verified]**                                                                                 | Quiet per-card progress that visibly nears completion: a small ring plus "3 of 5"                              | https://lawsofux.com/goal-gradient-effect/                                                                                                                               |
| Endowed progress (Nunes & Drèze)          | Car-wash card study: 34% redemption with a head start against 19% without **[verified]**                                            | Never fake progress. The honest version here: a dropped todo advances the ring too                             | https://jonathanbecher.com/2020/05/24/endowed-progress-effect/                                                                                                           |
| Peak-end rule                             | People judge an experience by its peak and its end. The evidence comes from short, aversive episodes **[verified]**                 | Clearing the whole day is the one peak moment: one brief, calm flourish, then a restful card                   | https://www.nngroup.com/articles/peak-end-rule/                                                                                                                          |
| Reward-prediction error                   | Unexpected rewards trigger a dopamine response; fully predicted ones do not **[verified]**                                          | Small variation in how feedback looks or sounds is fine. Never use variability to pull the user back in        | https://pmc.ncbi.nlm.nih.gov/articles/PMC3176615/                                                                                                                        |
| Manipulation matrix (Eyal) and critique   | Where variable reward turns manipulative **[verified]**                                                                             | No notifications or hooks built on the reward                                                                  | https://designli.co/blog/using-the-manipulation-matrix-for-ethical-behavioral-design/ · https://axbom.com/nir-eyal-habit-danger/                                         |
| Completion bias (Gino & Staats)           | People pick easy tasks to get the feeling of finishing **[verified]**                                                               | Don't reward volume. No counts as a headline metric                                                            | https://hbr.org/2016/03/your-desire-to-get-things-done-can-undermine-your-effectiveness                                                                                  |
| Streaks and loss aversion                 | Streaks work through loss aversion and produce documented anxiety **[verified]**; Todoist had to add a Vacation mode **[verified]** | No streaks, no red overdue badges, no guilt copy on empty or unfinished days                                   | https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature · https://www.todoist.com/help/articles/turn-on-or-off-vacation-mode-in-todoist-pAQmRp |
| Aesthetic-usability effect                | Attractive interfaces are perceived as easier to use, but beauty only masks minor flaws **[verified]**                              | Visual craft is worth the investment, and it does not replace getting the basics right                         | https://www.nngroup.com/articles/aesthetic-usability-effect/                                                                                                             |
| Reduced motion (WCAG 2.3.3)               | Motion triggered by interaction must be possible to switch off **[verified]**                                                       | Under `prefers-reduced-motion`, replace scale, translate and spring effects with opacity or colour cross-fades | https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions · https://web.dev/learn/accessibility/motion                                            |
| Anxiety from red "overdue" styling        | Anecdotal, but consistent across sources **[unverified]**                                                                           | Same conclusion as `DESIGN.md`: dropped is not red                                                             | https://dev.to/vaicurious/why-most-productivity-apps-slowly-become-anxiety-machines-57c1                                                                                 |

### What acclaimed apps do

- **Things 3** — completed items stay visible and dimmed during the day; cancelled items are logged
  alongside completed ones **[verified]** (https://vanja.io/things-3-complete-guide/). MacStories
  called it "full of little delights" **[verified]**
  (https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/). Its progress
  pie fills as tasks complete and reads well at small sizes **[verified]**
  (https://culturedcode.com/things/features/). The exact delay before a completed item moves, and
  the checkbox animation specs, are **[unverified]**.
- **Clear** — consecutive completions play a rising scale of pings instead of one repeated sound,
  and delete has its own "swoosh" **[verified]**
  (https://jesperbylund.com/blog/a-ux-review-of-Clear-todo-list-manager-of-the-future/). Heat-map
  colours and gestures: https://www.macstories.net/reviews/clear/.
- **Asana** — celebration creatures appear only occasionally and can be switched off; the stated
  reason is countering negativity bias **[verified]**
  (https://medium.com/asana-design/cause-for-celebration-dd4cfbb01fa0). Zapier explains their pull as
  a variable-ratio schedule (https://zapier.com/blog/asana-celebrations/).
- **Sunsama** — the daily shutdown ritual is deliberately calm, with no gamification, and users
  credit it with a sense of closure **[verified]**
  (https://www.sunsama.com/features/daily-planning-and-shutdown).
- **Superlist** — its completion chime is widely praised; the app added an off toggle
  **[verified]** (https://www.superlist.com/updates/mobile-improvements-more).
- **(Not Boring)** — "a big action needs a big wind up": wind-up, burst, sound and haptics together
  **[verified]** (https://notbor.ing/words/the-most-satisfying-checkbox). Use that approach only for
  the day-cleared moment, never per item.
- **Todoist Karma, TickTick achievement scores** — examples of volume-based rewards to avoid
  (https://www.todoist.com/help/todoist/features/introduction-to-karma-OgWkWy ·
  https://support.ticktick.com/hc/en-us/articles/360011086372-Achievement-and-Statistics).
- Over-use of confetti: https://uxdesign.cc/the-over-confetti-ing-of-digital-experiences-af523745db19
  (page returned 403; only the search snippet was read, so **[unverified]**).
- Not confirmed from any source: completion details of Amie, Tweek, Streaks, Apple Reminders,
  Linear; "#TodoistZero" illustrations; Duolingo's tiering of milestone celebrations beyond what
  https://blog.duolingo.com/streak-milestone-design-animation mentions.

## 2. Motion

### Rules

1. **Frequency decides how much motion to use.** Emil Kowalski's scale: actions done 100+ times a
   day get no animation, tens a day get drastically reduced animation, rare actions can have
   delight; "never animate keyboard initiated actions" **[verified]**
   (https://emilkowal.ski/ui/great-animations ·
   https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md). Rauno
   Freiberg: "when so commonly executed, the interaction novelty is also diminished" **[verified]**
   (https://rauno.me/craft/interaction-design). Benji Taylor (Family): "delight increases as feature
   usage decreases" **[verified]** (https://benji.org/family-values).
   For Daily: arrow-key day flips are instant or about 150 ms; drag and click flips get the full
   spring; checking a todo gets a small flourish; clearing the day is the only celebratory moment.
2. **Durations.** UI animations under 300 ms; button press feedback 100–160 ms; press scale 0.97;
   entry scale 0.9–0.97 plus opacity, never `scale(0)`; stagger 30–80 ms; never `ease-in`, never
   `transition: all` **[verified]** (Emil's repo, above). Rauno caps direct interactions at 200 ms
   **[verified]** (https://interfaces.rauno.me/).
3. **Easing tokens** **[verified]** (Emil's repo):
   - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
   - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for movement that stays on screen
   - `cubic-bezier(0.32, 0.72, 0, 1)` at 500 ms, the iOS sheet curve
     (https://emilkowal.ski/ui/building-a-drawer-component)
4. **Springs for movement, easing for colour and opacity.** Springs feel organic and need
   JavaScript **[verified]**
   (https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/). They carry
   velocity, so they cope with interruption **[verified]**
   (https://medium.com/kaliberinteractive/how-i-transitioned-from-ease-to-spring-animations-5a09eeca0325).
5. **Everything interruptible.** Rapid checks, an uncheck mid-animation or a day flip must never
   wait for an animation **[verified]** (https://rauno.me/craft/interaction-design). Apple HIG says
   the same (https://developer.apple.com/design/human-interface-guidelines/motion — page returned a
   thin summary, so weakly verified).
6. **Performance.** Animate only `transform` and `opacity` **[verified]**
   (https://vercel.com/design/guidelines). Motion's `x`/`y`/`scale` shorthand can drop frames under
   load; animating the full `transform` string avoids it **[verified]** (Emil's repo). Keep blur
   under 20 px **[verified]**. `will-change: transform` only on the mounted cards **[unverified]**.
7. **Reduced motion.** Keep opacity and colour changes at about 200 ms, drop transforms, never play
   particles **[verified]**
   (https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

### Spring values

- Emil's default: `{ type: 'spring', duration: 0.5, bounce: 0.2 }`, bounce kept between 0.1 and 0.3
  **[verified]**.
- Apple (WWDC18 session 803, "Designing Fluid Interfaces"): start critically damped (damping 1.0,
  response 0.4); use damping about 0.8 with response 0.3–0.4 only for momentum gestures
  **[verified]** via https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md ·
  https://developer.apple.com/videos/play/wwdc2018/803/.
- In Motion terms that is roughly stiffness 250, damping 31, mass 1 **[unverified]** (derived from
  the SwiftUI formula; close to the common 300/30).
- For Daily: `bounce: 0` on keyboard and click flips, about 0.15 only after a drag release.
- CSS-only alternative: a generated `linear()` spring inside `@supports` **[verified]**
  (https://www.joshwcomeau.com/animation/linear-timing-function/).

## 3. The day deck

- **Depth.** Sonner scales each stacked layer by `1 - 0.05 × index`, offsets it 14 px and uses
  `400ms ease` **[verified]** (https://emilkowal.ski/ui/building-a-toast-component). interior.dev's
  swipe deck: scale `1 - depth × 0.045`, y offset `depth × 10px`, rotation ±8° mapped over ±200 px of
  drag, three cards mounted, radius 14 px **[verified]**, lesser-known source
  (https://www.interior.dev/docs/swipe-deck). Suggested for side-peeking cards: scale 0.92–0.95,
  40–60 px visible, 1–2° rotation, opacity 0.6–0.7 instead of blur, a smaller shadow stack on the
  back cards **[unverified]**. Use transitions or springs, not keyframes, so flips can retarget
  mid-flight **[verified]**.
- **Drag to flip.** Commit only on release **[verified]** (Rauno). Commit when distance passes the
  threshold or velocity exceeds 0.11 px/ms **[verified]** (Sonner). interior.dev: 92 px threshold, or
  520 px/s once 35% of the threshold is reached; return spring 150/27/1 **[verified]**. Momentum
  projection `(v / 1000) × d / (1 − d)` with d = 0.998 (0.99 for snappier) **[verified]**.
  Rubber-band at the limits: `(x × dim × 0.55) / (dim + 0.55 × |x|)` **[verified]**. About 10 px of
  hysteresis before locking the drag axis; pointer capture during the drag **[verified]** (all from
  Emil's apple-design skill). Motion's inertia defaults: power 0.8, timeConstant 700
  (https://motion.dev/docs/react-transitions).
- **Trackpad swipe in Electron.** Chromium does not expose a momentum phase, so momentum wheel
  events cannot be told apart from real ones **[unverified]**
  (https://issues.chromium.org/issues/40704952, behind a login). Motion's team found a plain deltaX
  accumulator fails; their recogniser detects consistent deceleration and re-arms on direction
  reversal or re-acceleration **[verified]**
  (https://motion.dev/magazine/introducing-the-motion-carousel). A workable heuristic: require
  `|deltaX| > |deltaY| × 1.3`, accumulate to about 90 px, flip once, lock until the deltas stop
  decreasing or 150–400 ms pass with no events, and `preventDefault` the wheel event. Values from
  https://github.com/risa-labs-inc/BossConsole/pull/650 and
  https://dev.to/linards_liepenieks/building-custom-scroll-snap-sections-a-journey-through-mac-trackpad-hell-1k2k
  **[verified]** as values, **[unverified]** as best practice (individual write-ups). The
  `wheel-gestures` package implements this detection.

## 4. The completion moment

- **Done (✓).** Keep a hidden native `<input type="checkbox">` inside a `<label>` with an
  `aria-hidden` SVG for the visual; fill first, draw the check about 100 ms later, reverse the order
  when unchecking **[verified]**
  (https://tomdohnal.com/posts/custom-checkbox-in-react-animated-and-accessible). In Motion, animate
  `pathLength` from 0 to 1 **[verified]** (https://motion.dev/docs/react-svg-animation).
  `text-decoration` cannot be animated, so the strike is a pseudo-element with `scaleX(0 → 1)` and
  `transform-origin: left`, or a `background-size` gradient for multi-line text **[verified]**,
  lesser-known source (https://codefronts.com/components/css-checkboxes/strikethrough-checkbox/).
- **Suggested sequence** **[unverified]** (composed from Emil's duration ranges): fill 120 ms, check
  draw 180 ms with `--ease-out`, strike 200 ms, text fades to 50–60% over 200 ms, then after
  600–800 ms the row layout-animates to the bottom, so a mis-click can be undone before it moves.
- **Dropped (✗)** **[unverified]** (reasoned from the frequency rule and section 1): no path draw, no
  scale; cross-fade to a muted ✗ over 150 ms, text to about 40% opacity, same settle delay. It
  signals release, not achievement.
- **Day cleared.** One calm flourish: the progress ring closes and morphs into a check once, the
  header line changes (for example "Day cleared"), then the card rests. Empty states should tell the
  user where they stand **[verified]**
  (https://www.nngroup.com/articles/empty-state-interface-design/). Confetti-class effects only for
  rare milestones, with an off switch.
- **Progress.** A 16 px ring in the header next to "3 of 5" in tabular numerals, animated with
  `stroke-dashoffset`; a 6 px ring or dot on the visible edge of peeking cards **[unverified]**
  (our design, modelled on the Things progress pie).

### Sound

- "The more often an interaction happens, the less intrusive that sound should be"; over-using sound
  takes away from the moments worth highlighting **[verified]**
  (https://design.google/library/ux-sound-haptic-material-design). Material reserves "hero" sounds
  for infrequent moments and uses finishing a to-do list as its example **[unverified]** (search
  snippet only: https://m2.material.io/design/sound/applying-sound-to-ui.html).
- The pleasantness of an interface sound drives the emotional response to it **[verified]**
  (https://link.springer.com/article/10.1007/s12193-011-0086-0). The main risk is annoyance
  (https://dl.acm.org/doi/fullHtml/10.1145/3673805.3673822).
- For Daily: one short soft tick per completion with pitch rising on consecutive checks (Clear), a
  warmer chime for day cleared, a lower softer sound for ✗ (never an error tone), one-click mute.
  Whether sound should default on or off: no evidence found either way **[unverified]**.
- Free sound sources: Kenney "UI Audio" and "Interface Sounds" (CC0); freesound.org with the CC0
  filter; Material sound resources (CC-BY 4.0, **[unverified]**); `snd-lib` (MIT code, licence of the
  sounds **[unverified]**).

## 5. Surfaces, type, input, scrolling

- **Shadows.** Tobias Ahlin's layered shadow **[verified]**
  (https://tobiasahlin.com/blog/layered-smooth-box-shadows/):
  `0 1px 2px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.07), 0 4px 8px rgba(0,0,0,.07), 0 8px 16px rgba(0,0,0,.07), 0 16px 32px rgba(0,0,0,.07), 0 32px 64px rgba(0,0,0,.07)`.
  Josh Comeau: one light-source ratio across the app, tint shadows with the background hue instead of
  pure black, more offset and blur with less alpha as elevation rises **[verified]**
  (https://www.joshwcomeau.com/css/designing-shadows/). Vercel: at least two shadow layers plus a
  semi-transparent border; nested radii concentric **[verified]**
  (https://vercel.com/design/guidelines). Concentric radius: inner = outer − padding − border
  **[verified]**
  (https://dev.to/sgbp/the-concentric-border-radius-rule-why-nested-rounded-corners-look-slightly-wrong-3hog).
  Inner highlight `inset 0 1px 0 rgb(255 255 255 / .6)`, ring `0 0 0 1px rgb(0 0 0 / .06)`, paper grain
  via SVG `feTurbulence` at 2–4% opacity **[unverified]**.
- **Dark mode.** Show elevation with lighter surfaces, not shadows **[verified]** as a concept
  (https://m2.material.io/design/color/dark-theme.html); the specific figures (#121212, overlays 5%
  to 16%) are **[unverified]**. OKLCH tokens with `light-dark()` and `color-mix(in oklch, …)`
  (https://evilmartians.com/chronicles/exploring-the-oklch-ecosystem-and-its-tools, exact recipe
  **[unverified]**).
- **Type.** Inter Variable with `font-feature-settings: 'liga' 1, 'calt' 1`,
  `font-optical-sizing: auto`, `tnum` for counts and dates **[verified]** (https://rsms.me/inter/).
  Antialiased smoothing, no weights under 400, headings 500–600 **[verified]** (Rauno).
  `text-wrap: balance` on the header, `pretty` on todo text
  (https://developer.chrome.com/blog/css-text-wrap-pretty). Use the `…` character in placeholders
  **[verified]** (Vercel). A serif for the date header (Instrument Serif, Newsreader) is a taste
  suggestion **[unverified]** (https://www.untitledui.com/blog/best-free-fonts). A 14 px base is the
  Electron-native convention **[verified]**
  (https://getlotus.app/21-making-electron-apps-feel-native-on-mac) — `DESIGN.md` argues for 16 px,
  see section 7.
- **Input.** Enter submits through a `<form>`; optimistic updates; undo with a safe window instead
  of confirm dialogs; focus ring as a `box-shadow` on `:focus-visible`; hit targets at least 24 px;
  hover-revealed actions gated behind `@media (hover: hover) and (pointer: fine)` **[verified]**
  (Vercel, Rauno). New item entrance: opacity plus `translateY(-8px → 0)`, 200 ms, skipped when
  items are added in quick succession **[unverified]**. When placeholder or empty-state text
  changes, keep the wording stable and change only the part that differs **[verified]** (Family).
- **Scrolling.** No smooth-scroll library: hijacking the wheel fights native trackpad inertia and
  hurts keyboard scrolling (`lenis` itself is healthy, it is the wrong tool for a desktop app).
  Scroll-driven fade masks that only appear when the list overflows: register `--top-fade` and
  `--bottom-fade` with `@property`, animate them with `animation-timeline: scroll(self)`, apply
  `mask: linear-gradient(#0000, #fff var(--top-fade) calc(100% - var(--bottom-fade)), #0000)`
  **[verified]**, adapted to the vertical axis
  (https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/).
  `scrollbar-width: thin; scrollbar-color: <thumb> transparent; scrollbar-gutter: stable`; in Chrome
  121+ the standard properties override `::-webkit-scrollbar`, so pick one approach **[verified]**
  (https://developer.chrome.com/docs/css-ui/scrollbar-styling). `overscroll-behavior: contain` so the
  end of a list does not flip the deck **[unverified]**.
- **Desktop details.** `cursor: default` and `user-select: none` on chrome, todo text stays
  selectable; `BrowserWindow` `backgroundColor` matching the theme and `show` on `ready-to-show`
  **[verified]** (Lotus link above). Under `prefers-contrast: more`, solid borders and no grain
  **[unverified]**.

## 6. Libraries

Versions, publish dates, peer dependencies and licences are from `npm view` on 2026-09-19
**[verified]**. Sizes are Bundlephobia min+gzip for the whole package; tree-shaken imports are
smaller. All picks list React 19 in their peer range and none needs Tailwind.

### Platform first: Electron 44.4.3 ships Chromium 152 **[verified]**

Available with no dependency: `document.startViewTransition` (111), `view-transition-class` (125),
`view-transition-name: match-element` (137), element-scoped view transitions (147), scroll-driven
animations (115), `@starting-style` and `transition-behavior` (117), `linear()` easing (113),
`interpolate-size` / `calc-size` (129), anchor positioning (125–151), `scrollsnapchange` (129),
scroll-state container queries (133), `field-sizing: content` (123), `light-dark()` (123).

### Picks

| Need                                                 | Pick                                                                  | Version (published) | Licence | gzip                                               | Notes                                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ------------------- | ------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Springs, layout and enter/exit, checkmark draw, drag | `motion`                                                              | 13.4.0 (2026-09-16) | MIT     | up to 47 kB; less with LazyMotion                  | One dependency covers most of the feel                                                                                            |
| Trackpad two-finger swipe detection                  | `wheel-gestures`                                                      | 2.3.0 (2026-09-07)  | MIT     | small                                              | Pairs with Motion drag for the deck                                                                                               |
| Menus, popover, tooltip, dialog, checkbox            | `@base-ui/react`                                                      | 1.8.0 (2026-09-04)  | MIT     | about 15–25 kB for 3–4 components **[unverified]** | Ships no styles; `data-starting-style` / `data-ending-style` suit CSS Modules. Component coverage is from memory **[unverified]** |
| Undo toast                                           | `sonner`                                                              | 2.0.8 (2026-08-09)  | MIT     | 9.4 kB                                             |                                                                                                                                   |
| Reordering todos                                     | `@dnd-kit/react`                                                      | 0.5.0 (2026-06-11)  | MIT     | 33 kB                                              | Still 0.x, pin the exact version. Dragging a todo onto another day is **[unverified]**                                            |
| Animated count                                       | `@number-flow/react`                                                  | 0.6.2 (2026-07-18)  | MIT     | 6.3 kB                                             |                                                                                                                                   |
| Keyboard shortcuts                                   | `tinykeys`                                                            | 4.0.0               | MIT     | 1 kB                                               | Runner-up `react-hotkeys-hook` 5.3.3                                                                                              |
| Icons                                                | `lucide-react`                                                        | 1.47.0              | ISC     | per icon                                           | Runner-up `@tabler/icons-react` 3.47.0                                                                                            |
| Fonts                                                | `@fontsource-variable/inter`                                          | 5.3.0               | OFL-1.1 | about 100 kB woff2 **[unverified]**                | Local files, right for Electron                                                                                                   |
| Rare milestone celebration                           | `canvas-confetti`                                                     | 1.9.4 (2025-10)     | ISC     | 4.3 kB                                             | Has `disableForReducedMotion`                                                                                                     |
| Command palette (later)                              | `cmdk`                                                                | 1.1.1 (2025-03)     | MIT     | 15 kB                                              | Stable but quiet                                                                                                                  |
| Sound                                                | plain Web Audio / `HTMLAudioElement`                                  | —                   | —       | 0                                                  | Two or three ticks do not need a library                                                                                          |
| Window position and size                             | Electron's native `windowStatePersistence: true` plus a unique `name` | Electron 44         | —       | 0                                                  | Marked experimental; confirmed in the installed `electron.d.ts` **[verified]**                                                    |

Motion + Sonner + `wheel-gestures` deliver most of the feel; the whole list is roughly 120–140 kB
gzip.

### Runners-up

`@formkit/auto-animate` 0.10.0 (3.2 kB, one-line list animation, no springs); `@react-spring/web`
10.1.2 (no layout animation); `radix-ui` 1.6.7 (mature, what shadcn snippets assume);
`react-aria-components` 1.21.1 (strongest accessibility, heavier);
`@atlaskit/pragmatic-drag-and-drop` 3.1.0 (robust, you write the move animations);
`embla-carousel-react` 8.6.0 + `embla-carousel-wheel-gestures` 8.1.0 (the library research's pick
for the deck; rejected because Embla expects a fixed list of slides and Daily's deck is endless days
with five cards mounted); `@lottiefiles/dotlottie-react` 0.19.16 or `@rive-app/react-canvas` 4.34.3
if designer-made checkbox assets are ever wanted; `react-day-picker` 10.0.1 for a date jump.

### Avoid

| Package                                             | Why                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `@use-gesture/react` 10.3.1                         | No release since 2024-03-21; maintainer looking for successors   |
| `use-sound` 5.0.0 / `howler` 2.2.4                  | README says "semi-maintained"; howler's last release was 2023-09 |
| `vaul` 1.1.2                                        | README says unmaintained; a drawer is not a desktop idiom        |
| `electron-window-state` 5.0.3, `electron-win-state` | Last published 2018 and 2022                                     |
| `keen-slider` 6.8.6, `party-js`                     | Last published 2023 and 2022                                     |
| `@base-ui-components/react`                         | Deprecated name, frozen at 1.0.0-rc.0; use `@base-ui/react`      |
| `lottie-react` 3.1.2                                | 196 kB                                                           |
| `@dnd-kit/core` 6.3.1 for new code                  | Last published 2024-12; superseded by `@dnd-kit/react`           |
| `gsap` 3.15.0                                       | Custom "no charge" licence, imperative, overkill here            |
| `lenis` in this app                                 | Healthy package, wrong tool for a desktop app                    |

### Component collections to mine for ideas

Copy-paste source, mostly Tailwind + Motion; the Motion logic ports to CSS Modules by swapping class
names. Names are from memory **[unverified]** except React Bits.

- **React Bits** — ships CSS-only variants; MIT plus Commons Clause. CountUp, ShinyText,
  Stack/CardSwap **[verified]**.
- **Animate UI** — animated checkbox (Radix and Base UI), "Playful Todolist".
- **Motion Primitives** — TextShimmer, AnimatedNumber, TransitionPanel.
- **Magic UI** — AnimatedCircularProgressBar, AnimatedList.
- **Aceternity** — CardStack. **Cult UI**, **Origin UI** — checkbox and input variants.

### Electron window polish (`src/main/window.ts`)

- No white flash: `show: false`, `win.show()` on `'ready-to-show'`, theme-aware `backgroundColor`
  from `nativeTheme.shouldUseDarkColors`.
- Title bar: `titleBarStyle: 'hidden'` with `titleBarOverlay: { color, symbolColor, height }`
  (Windows and Linux); on macOS `'hiddenInset'` or `trafficLightPosition`. `-webkit-app-region: drag`
  on the card header area, `no-drag` on controls inside it.
- Materials: `vibrancy` is macOS only; `backgroundMaterial: 'mica' | 'acrylic'` needs Windows 11
  22H2; Linux has no equivalent. Transparent windows are not resizable and misbehave on Wayland, so
  stay opaque on Linux.

## 7. Where this differs from `DESIGN.md`

| Topic            | `DESIGN.md`                                    | This research                                                                                                 | Suggested resolution                                                                                |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Completion       | "No confetti, sounds or counters"              | A soft optional tick, a quiet "3 of 5" ring, one calm day-cleared flourish; confetti only for rare milestones | Both agree per-item feedback stays small. Decide on sound and the ring; skip confetti unless wanted |
| Easing           | `--ease-out: cubic-bezier(0.2, 0, 0, 1)`       | `cubic-bezier(0.23, 1, 0.32, 1)` (Emil Kowalski), springs for movement                                        | Try both on the card flip and pick by feel                                                          |
| Elevation        | One shadow; depth carried by scale and opacity | Six-layer tinted shadow on the front card, fewer layers on peeking cards                                      | Compatible: still one elevation level, only a smoother shadow                                       |
| Typeface         | One family (Inter), no display face on todos   | Inter for todos; a serif for the date header as a taste option                                                | The fluency argument covers todo text only; a header serif is optional                              |
| Body size        | 16 px, argued from visual angle                | 14–15 px Electron convention                                                                                  | Keep 16 px; the `DESIGN.md` argument is stronger evidence                                           |
| Card flip timing | 300 ms CSS transition                          | Spring for drag and click, near-instant for arrow keys                                                        | Adopt the frequency rule                                                                            |

Agreements: dropped is never red; done todos stay visible; no streaks, badges or guilt copy;
`prefers-reduced-motion` must be handled; Inter bundled through `@fontsource-variable`.

## 8. Suggested build order

1. **Foundations** — fonts, tokens, layered shadow, scroll fades and scrollbars, window polish.
2. **Completion moment** — check draw, strike sweep, row settles to the bottom, calm ✗, new todos
   animate in, delete becomes an undo toast.
3. **Deck** — spring flips, drag to change day with rubber-banding, trackpad swipe, near-instant
   arrow keys.
4. **Progress and day cleared** — header ring, rings on peeking cards, sound with a mute.
5. **Later** — reordering todos, right-click menu, command palette.

## 9. Gaps in this research

- The Motion card-stack tutorial values are paywalled (https://motion.dev/tutorials/react-card-stack).
- Paco Coursey's craft essay returned a 404; the animations.dev spring lesson could not be fetched.
- No authoritative write-up of Things or Todoist completion timings was found.
- Codrops has only generic stack effects, nothing specific to a peeking day deck
  (https://tympanus.net/codrops/2015/10/28/effect-ideas-for-card-stacks/).
- Material 3 motion tokens exist but the exact values were not fetched
  (https://m3.material.io/styles/motion/easing-and-duration/tokens-specs).
- Dan Saffer's microinteractions model (trigger, rules, feedback, loops and modes):
  https://www.oreilly.com/library/view/microinteractions/9781449342760/ — the "long loops" detail is
  **[unverified]**.
