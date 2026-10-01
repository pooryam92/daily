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

## Undo of two deletes, oldest first

A bug, older than steps. Undo puts a deleted todo or step back at the index it had, in the list as
it is when Undo is clicked. Delete two and undo the older first, and the second comes back one place
off: steps `w, l, c`, delete `w` then `c`, undo `w` then `c`, gives `w, c, l`. Top-level todos do
the same (`restored` in `domain/todo-rules.ts`). A fix would put it back next to the todo it
followed, not at an index.

## The text across the whole row at rest

A design item, older than steps. Where there is a mouse, `tomorrow` and `delete` are hidden at rest
but keep their width, so nothing shifts on hover. At the 640×420 window that is about 147px of a
372px row: a todo's text wraps at about 161px instead of about 308px. At a 720px card it is 147 of
692px, so it matters most below a card of about 600px. The proposal: on fine pointers the text takes
the whole row at rest, and the words lay over its end on hover or focus, on a fade of the row's
background; touch keeps them in the row, since there is no hover there.
