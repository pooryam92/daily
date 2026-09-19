# Daily — design foundations

Design tokens for Daily (colour, typography, spacing, motion) and the reasoning behind each choice.
The tokens live in `src/renderer/src/styles/global.css`; component CSS modules should only ever
reference tokens, never raw values.

Every choice below is tagged with how solid its evidence is:

- **[strong]** — replicated research or a measurable standard (contrast ratios, Fitts's law).
- **[moderate]** — published and plausible, but with mixed replications or a narrower context.
- **[convention]** — no real science behind it; chosen for consistency or familiarity.

Colour–emotion claims ("blue is calming") are mostly **weak** science, so no colour here is picked
for its supposed mood. Colours are picked on contrast, colour-blind safety and learned convention.

## 1. What the app is, in design terms

Daily is not a task manager. It is **one card per day**, and three facts about it drive the design:

| Product fact                                | Psychological reading                                                                                                                                                                                                                           | Design consequence                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Every day starts empty; nothing rolls over  | **Fresh start effect** — temporal landmarks (a new day) separate people from past failures and raise motivation (Dai, Milkman & Riis 2014) **[strong]**                                                                                         | An empty card is a feature. No overdue badges, no carried-over counts, no streaks, no guilt copy.            |
| A todo can be **dropped**, not just done    | **Goal disengagement** — being able to let go of goals predicts better well-being (Wrosch et al. 2003) **[strong]**. Unresolved goals keep intruding on attention until they are closed or planned (Masicampo & Baumeister 2011) **[moderate]** | Dropping is a healthy decision, not a failure. It must never look like an error — so it must **not be red**. |
| Done todos stay on the card, struck through | **Progress principle** — visible small wins are the strongest day-to-day motivator (Amabile & Kramer 2011) **[moderate]**                                                                                                                       | Done items stay readable (full AA contrast). They are the day's evidence, not clutter to hide.               |

Two more principles apply to the whole UI:

- **Processing fluency** — the same instructions printed in a harder-to-read font are judged to
  take more time and effort (Song & Schwarz 2008, "If it's hard to read, it's hard to do")
  **[moderate]**. For a todo app this is the most relevant typography finding there is: todo text
  gets the most legible treatment in the app; personality goes elsewhere.
- **Isolation effect** — the one item that differs from its surroundings is the one noticed and
  remembered (von Restorff 1933) **[strong]**. The interface is neutral; saturated colour is
  rationed to exactly three meanings: _now/interactive_ (accent), _done_, and _danger_.

## 2. Colour

### Palette idea

Warm paper and blue ink (the original sketch in this folder is literally that). Warm neutrals for
everything structural, one blue for "now" and interaction, green for done, red for real errors only.
The dark theme uses the same warm neutrals rather than switching to cool blue-greys, so the app
keeps one identity in both modes **[convention]**.

### Tokens

| Token             | Light                           | Dark                           | Role                                                                             |
| ----------------- | ------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `--bg`            | `#eceae4`                       | `#191816`                      | Window background behind the card stack                                          |
| `--surface`       | `#fdfcf9`                       | `#242320`                      | Day card                                                                         |
| `--border`        | `#d9d6cd`                       | `#383630`                      | Decorative hairlines (card edge)                                                 |
| `--border-strong` | `#918d82`                       | `#78756d`                      | Boundaries that identify a control (the input) — ≥ 3:1                           |
| `--text`          | `#22211e`                       | `#ecebe7`                      | Open todos, day title                                                            |
| `--text-muted`    | `#66625a`                       | `#a09d94`                      | Done todos, placeholder, nav arrows, secondary labels — ≥ 4.5:1                  |
| `--text-faint`    | `#8a867b`                       | `#7a776f`                      | Dropped todos, idle ✓/✗ marks, the list bullet — ≥ 3:1, never on `--bg` for text |
| `--accent`        | `#2f5fd0`                       | `#86a3f7`                      | "Today", focus ring, links/buttons                                               |
| `--done`          | `#23824a`                       | `#4cc381`                      | Pressed ✓ mark                                                                   |
| `--dropped`       | `#57534a`                       | `#b5b2a9`                      | Pressed ✗ mark — deliberately a **neutral**, see below                           |
| `--danger`        | `#b93a2c`                       | `#f07a6d`                      | Destructive hover (delete), error text                                           |
| `--danger-solid`  | `#b93a2c`                       | `#b93a2c`                      | Error banner background                                                          |
| `--on-danger`     | `#ffffff`                       | `#ffffff`                      | Text on `--danger-solid`                                                         |
| `--hover`         | `rgb(128 128 128 / 0.10)`       | same                           | Row hover                                                                        |
| `--hover-strong`  | `rgb(128 128 128 / 0.18)`       | same                           | Button hover                                                                     |
| `--shadow`        | `0 10px 30px rgb(0 0 0 / 0.12)` | `0 10px 30px rgb(0 0 0 / 0.5)` | Card elevation                                                                   |

Neither theme uses pure black or pure white: maximum-contrast pairs cause glare/halation,
especially light text on black for people with astigmatism **[moderate]**. Text contrast tops out
around 13–16:1.

### Measured contrast (WCAG 2.x)

Targets: 4.5:1 for text, 3:1 for icons and control boundaries **[strong]**.

| Pair                              | Light | Dark | Target |
| --------------------------------- | ----- | ---- | ------ |
| `--text` on `--surface`           | 15.7  | 13.2 | 4.5    |
| `--text-muted` on `--surface`     | 5.9   | 5.8  | 4.5    |
| `--text-muted` on `--bg`          | 5.1   | 6.5  | 4.5    |
| `--text-faint` on `--surface`     | 3.5   | 3.5  | 3.0    |
| `--accent` on `--surface`         | 5.6   | 6.4  | 4.5    |
| `--accent` on `--bg`              | 4.8   | 7.3  | 4.5    |
| `--done` on `--surface`           | 4.7   | 7.1  | 3.0    |
| `--dropped` on `--surface`        | 7.5   | 7.4  | 3.0    |
| `--danger` on `--surface`         | 5.5   | 5.8  | 4.5    |
| `--on-danger` on `--danger-solid` | 5.7   | 5.7  | 4.5    |
| `--border-strong` on `--surface`  | 3.2   | 3.4  | 3.0    |

For comparison, the palette this replaces measured: muted text 3.4 (light) / 4.3 (dark), dropped
todo text 2.0 / 2.4, idle marks 1.6 / 1.9, dark-mode error banner 3.1.

### Why dropped is not red

The old palette used one red for both "dropped" and "your change was not saved". That equates a
deliberate, healthy decision with a system failure. Red is also a learned failure/avoidance signal —
brief exposure to red before a task has been shown to impair performance (Elliot et al. 2007)
**[moderate — replications are mixed]**. Whether or not that effect is robust, the convention is:
red means _something went wrong_. Nothing went wrong when you drop a todo.

So the semantics are split:

- `--dropped` is a strong neutral. Done gets the app's only reward colour; dropped gets none —
  it is neither rewarded nor punished. It is just closed.
- `--danger` is reserved for things that actually are dangerous: a failed save, a failed load, and
  the irreversible `delete` action.

This also fixes colour-blind safety: red/green is the pair ~8% of men cannot tell apart
**[strong]**. Green-vs-neutral survives every common colour-vision deficiency, and the states are
additionally coded by shape (✓ / ✗) and by text treatment — colour is never the only signal.

### The three todo states

| State   | Text colour    | Decoration   | Mark                   | Intent                                             |
| ------- | -------------- | ------------ | ---------------------- | -------------------------------------------------- |
| open    | `--text`       | none         | both `--text-faint`    | The only full-ink items: what is left is what pops |
| done    | `--text-muted` | line-through | ✓ in `--done`, bold    | Still readable — it is today's progress            |
| dropped | `--text-faint` | none         | ✗ in `--dropped`, bold | Recedes furthest — it is meant to leave your mind  |

Set these as real colours. Do not reach a lighter shade with `opacity` on top of a muted colour:
the result is unmeasurable per theme (that is how dropped text ended up at 2:1).

Dropped text at 3.5:1 is a deliberate exception to the 4.5:1 text target, in the spirit of WCAG's
exemption for inactive content. If that ever feels too faint, promote it to `--text-muted` and
distinguish it from done by the missing strike-through alone.

### Accent rules

- "Today" is the temporal anchor of the whole app. Only the **Today** label gets `--accent`;
  "Yesterday" and "Tomorrow" use `--text-muted`. If three labels are blue, none of them is the
  landmark (isolation effect).
- Blue was chosen because it is the one hue that collides with neither status colour and stays
  distinct under red-green colour blindness — not because blue "means" anything **[convention]**.

## 3. Typography

### Typeface

```css
--font-sans: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif;
```

One family, bundled with the app (`@fontsource-variable/inter`, OFL licence, works offline — the
app must never load fonts from a CDN).

- **Why bundle instead of `system-ui`:** on Linux `system-ui` resolves to whatever the distro ships
  (Cantarell, Ubuntu, Noto, DejaVu…), so the app looks different on every machine. The current CSS
  also asks for `font-weight: 650`, which only exists in a variable font; on static system fonts it
  silently rounds to 700.
- **Why Inter:** large x-height, open apertures, designed for screens at small sizes. x-height —
  not nominal point size — is what drives legibility (Legge & Bigelow 2011) **[strong]**.
- **Why a plain sans and only one:** processing fluency (section 1). A characterful display face
  on the todos would make the tasks themselves feel harder.

### Scale

Four sizes. Fewer sizes means each size carries meaning.

| Token       | Size / line-height | Weight  | Tracking            | Used for                                  |
| ----------- | ------------------ | ------- | ------------------- | ----------------------------------------- |
| `--text-xs` | 12px / 1.4         | 600     | `0.06em`, uppercase | Relative-day label (TODAY)                |
| `--text-sm` | 13px / 1.4         | 400–500 | 0                   | `delete`, error banner, secondary buttons |
| `--text-md` | 16px / 1.5         | 400     | 0                   | Todo text, the add-todo input             |
| `--text-xl` | 24px / 1.2         | 650     | `-0.01em`           | Day title ("Saturday 19 September")       |

- **16px body, up from 15px.** Reading is fluent once x-height subtends about 0.2° of visual angle
  (Legge & Bigelow 2011) **[strong]**. At a 60 cm desktop viewing distance, Inter at 15px lands at
  0.207° — right on the threshold; 16px gives 0.221° and a little margin. Todo text is the content
  of the app, so it gets the margin.
- **Line-height 1.5 for todo text** — multi-line todos need it, and it matches WCAG 1.4.12's text
  spacing guidance. Titles are single-line and tighten to 1.2.
- **Uppercase only at 12px with +0.06em tracking.** All-caps removes word shape, so it is limited
  to one- and two-word labels and always letter-spaced **[convention]**.
- **Never signal state with weight on todo text.** Done and dropped change colour and decoration;
  the weight stays 400 so the list doesn't reflow or shimmer when a todo is toggled.

### Measure

The card is up to 960px wide, which at 16px leaves room for lines of ~105 characters. On screen, reading stays
efficient up to roughly 100 characters per line and comfort drops beyond it (Dyson 2004)
**[moderate]**. Most todos are short, so this only bites on long ones — but a narrower card also
brings the ✓/✗ marks closer to the text they act on (shorter pointer travel per Fitts's law
**[strong]**, and clearer grouping by proximity). Recommended: `--card-max: 720px`. Changing it
means updating the `590px` nav-arrow offset documented in `DayStack.module.css`.

## 4. Space, shape, elevation

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;

--radius-sm: 6px; /* marks */
--radius-md: 8px; /* rows, input */
--radius-lg: 14px; /* day card */
--radius-full: 999px; /* pills, nav arrows */
```

A 4px grid **[convention]**. The current CSS is already close; the stray `5px`, `6px`, `9px` and
`14px` paddings snap to the nearest step.

Target sizes: the ✓/✗ marks are 28×28px and the nav arrows 48×48px — both clear WCAG 2.5.8's
24×24px minimum **[strong]**. Keep the marks at 28px or larger; they are the most-used controls in
the app.

Only one elevation exists (`--shadow` on cards). The stack's depth is carried by scale and opacity,
so a second shadow level would add nothing.

## 5. Motion

```css
--duration-fast: 120ms; /* hover, press */
--duration-base: 200ms; /* a todo changing state */
--duration-slow: 300ms; /* cards travelling through the stack */
--ease-out: cubic-bezier(0.2, 0, 0, 1);
```

- Feedback within ~100ms reads as instantaneous; anything that blocks the user should finish under
  ~400ms (Miller 1968; Doherty & Thadani 1982) **[strong]**. Card travel at 300ms is inside that
  budget; do not go slower.
- Marking a todo done is the app's one reward moment. Keep it small and immediate: the ✓ takes its
  colour and the strike-through appears within `--duration-base`. No confetti, sounds or counters —
  the visible list of struck-through items _is_ the reward (progress principle).
- **`prefers-reduced-motion` is currently not handled.** The sliding, scaling card stack is exactly
  the kind of motion that triggers vestibular discomfort (WCAG 2.3.3). Under reduced motion, keep
  the opacity change and drop the transform transition:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

## 6. Focus

```css
--focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
```

The input currently sets `outline: none` and signals focus with a 1px border-colour change, which is
too subtle to count as a visible focus indicator. Use `box-shadow: var(--focus-ring)` on
`:focus-visible` for every interactive element. The input is auto-focused on the front card, so on
it the ring can be the quieter `border-color: var(--accent)` plus a 1px ring.

## 7. Drop-in token block

Replaces the `:root` blocks in `src/renderer/src/styles/global.css`. Renames: `--card` → `--surface`,
`--muted` → `--text-muted`; `--dropped` changes meaning (neutral, no longer the error colour).

```css
:root {
  color-scheme: light dark;

  /* colour */
  --bg: #eceae4;
  --surface: #fdfcf9;
  --border: #d9d6cd;
  --border-strong: #918d82;
  --text: #22211e;
  --text-muted: #66625a;
  --text-faint: #8a867b;
  --accent: #2f5fd0;
  --done: #23824a;
  --dropped: #57534a;
  --danger: #b93a2c;
  --danger-solid: #b93a2c;
  --on-danger: #ffffff;
  --hover: rgb(128 128 128 / 0.1);
  --hover-strong: rgb(128 128 128 / 0.18);
  --shadow: 0 10px 30px rgb(0 0 0 / 0.12);
  --focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);

  /* type */
  --font-sans: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-md: 16px;
  --text-xl: 24px;
  --leading-tight: 1.2;
  --leading-ui: 1.4;
  --leading-body: 1.5;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-title: 650;

  /* space and shape */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 14px;
  --radius-full: 999px;

  /* motion */
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #191816;
    --surface: #242320;
    --border: #383630;
    --border-strong: #78756d;
    --text: #ecebe7;
    --text-muted: #a09d94;
    --text-faint: #7a776f;
    --accent: #86a3f7;
    --done: #4cc381;
    --dropped: #b5b2a9;
    --danger: #f07a6d;
    --shadow: 0 10px 30px rgb(0 0 0 / 0.5);
  }
}
```

## 8. What changes in the components

| File                     | Change                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global.css`             | New token block; `font: var(--text-md) / var(--leading-body) var(--font-sans)`; import `@fontsource-variable/inter`; reduced-motion rule                                              |
| `App.module.css`         | Banner: `background: var(--danger-solid)`, `color: var(--on-danger)` (was `--dropped` + hard-coded `#fff`)                                                                            |
| `TodoItem.module.css`    | Done text `--text-muted`; dropped text `--text-faint` with **no** `opacity`; idle marks `--text-faint` with **no** `opacity: 0.45`; `.remove:hover` → `--danger`                      |
| `DayCard.module.css`     | `--card` → `--surface`; title `--text-xl` / `--leading-tight` / `-0.01em`; `.relative` in `--accent` only when the day is today, else `--text-muted` (needs a `data-today` attribute) |
| `AddTodoForm.module.css` | Border `--border-strong`; focus ring instead of bare `outline: none`                                                                                                                  |
| `DayStack.module.css`    | Nav arrows `--text-muted` (was 2.8:1 on `--bg`); if `--card-max` becomes 720px, the `590px` offset becomes `470px`                                                                    |

## 9. Things this design deliberately does not have

Each would undercut the fresh-start premise of the app:

- **Overdue / rollover indicators.** Yesterday's open todos stay on yesterday's card, in yesterday's
  colours. No red, no badge.
- **Streaks and completion percentages.** Streaks motivate through loss aversion — the thing the
  daily reset exists to avoid.
- **Priority colours, tags, labels.** Each added choice per item slows every decision (Hick 1952)
  **[strong]**, and every extra hue dilutes the three that carry meaning.

## References

- Amabile, T. & Kramer, S. (2011). _The Progress Principle_. Harvard Business Review Press.
- Dai, H., Milkman, K. L. & Riis, J. (2014). The fresh start effect: Temporal landmarks motivate aspirational behavior. _Management Science_, 60(10).
- Doherty, W. J. & Thadani, A. J. (1982). The economic value of rapid response time. IBM.
- Dyson, M. C. (2004). How physical text layout affects reading from screen. _Behaviour & Information Technology_, 23(6).
- Elliot, A. J., Maier, M. A., Moller, A. C., Friedman, R. & Meinhardt, J. (2007). Color and psychological functioning: The effect of red on performance attainment. _Journal of Experimental Psychology: General_, 136(1).
- Fitts, P. M. (1954). The information capacity of the human motor system in controlling the amplitude of movement. _Journal of Experimental Psychology_, 47(6).
- Hick, W. E. (1952). On the rate of gain of information. _Quarterly Journal of Experimental Psychology_, 4(1).
- Legge, G. E. & Bigelow, C. A. (2011). Does print size matter for reading? A review of findings from vision science and typography. _Journal of Vision_, 11(5).
- Masicampo, E. J. & Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. _Journal of Personality and Social Psychology_, 101(4).
- Miller, R. B. (1968). Response time in man-computer conversational transactions. _AFIPS Fall Joint Computer Conference_.
- Song, H. & Schwarz, N. (2008). If it's hard to read, it's hard to do: Processing fluency affects effort prediction and motivation. _Psychological Science_, 19(10).
- von Restorff, H. (1933). Über die Wirkung von Bereichsbildungen im Spurenfeld. _Psychologische Forschung_, 18.
- Wrosch, C., Scheier, M. F., Miller, G. E., Schulz, R. & Carver, C. S. (2003). Adaptive self-regulation of unattainable goals: Goal disengagement, goal reengagement, and subjective well-being. _Personality and Social Psychology Bulletin_, 29(12).
- W3C. _Web Content Accessibility Guidelines 2.2_ — 1.4.3 Contrast, 1.4.11 Non-text Contrast, 1.4.12 Text Spacing, 2.3.3 Animation from Interactions, 2.4.7 Focus Visible, 2.5.8 Target Size.
