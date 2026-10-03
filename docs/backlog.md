# Daily — backlog

Features that are wanted and not built yet. An entry says what the feature is and why it is wanted,
with the rows of `research.md` it rests on and their sources, so it can be judged without opening
three files. Once built, the entry goes: what was decided then is in `archive.md`. Remove it in the
commit that builds it.

## Undo of two deletes, oldest first

A bug, older than steps. Undo puts a deleted todo or step back at the index it had, in the list as
it is when Undo is clicked. Delete two and undo the older first, and the second comes back one place
off: steps `w, l, c`, delete `w` then `c`, undo `w` then `c`, gives `w, c, l`. Top-level todos do
the same (`restored` in `domain/todo-rules.ts`). A fix would put it back next to the todo it
followed, not at an index.

## Drop a row on the next day to move it

Moving a todo to tomorrow is a click on the calendar at its row's end. Dropping a dragged row on
the strip of the day after, or before, would move it there in the same gesture as a reorder. The
deck knows no todos (deck and card are content-blind), so the drop has to be handed in from the
page.
