# Daily — backlog

Features that are wanted and not built yet. An entry says what the feature is and why it is wanted,
with the rows of `research.md` it rests on and their sources, so it can be judged without opening
three files. Once built, the entry goes: what was decided then is in `archive.md`. Remove it in the
commit that builds it.

## Steps: deferred

What was left out of steps on a todo (built 2026-10-01, see `archive.md`). Wireframes:
https://claude.ai/artifact/CdsxWGqZSUdhN1GNtmZ8rG.

- **Keyboard indent.** Making a todo a step, and back, from the keyboard. Hard because Tab has to
  keep moving focus ([WCAG 2.1.2](https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html)),
  and the todo apps' Ctrl+] and Ctrl+[ need bracket keys.
- **Drag sideways to nest or un-nest.** The mouse gesture Reminders, Todoist, Google Tasks and
  TickTick share. Hard because rows are locked to the vertical axis, and a step only drags within
  its todo. It is also the only way to promote a step, which until then is deleted and re-added.
- **A chevron to fold an open todo.** Today an open todo shows its steps and a done one folds. If a
  chevron is added, remember the choice per todo, as Apple's outline views do.
