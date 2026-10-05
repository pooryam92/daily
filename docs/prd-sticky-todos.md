# Sticky todos — PRD

Agreed on 2026-10-05. Not built.

## Problem

After a few days away, today's card is empty and the unfinished work is spread over old cards. To
find what still matters you have to go back through each day. Most of it can stay where it is; a
few todos should not be lost.

## The feature

A sticky todo is one you choose to carry. It moves to today every morning until you finish it.
Everything else still stays on its day, so a day still starts empty apart from what you chose to
carry. Choosing each todo yourself is what makes this different from an overdue list.

## Rules

- **Stick and unstick** with a button on the todo's row. Unsticking leaves a normal todo on today.
- **It travels.** There is one todo, always on today. Days it passed through keep no trace of it.
- **Finishing** it makes it a normal done todo on the day it was ticked.
- **No limit** on how many. Revisit this if stickies start to outweigh today's own todos.
- **Outside the ring.** An open sticky does not hold today's ring open; the day can be Cleared
  while you still carry it.
- **At the bottom of the card**, under today's todos, set apart so the ring reads right.
- **Age shows as maturing**, like wine or cheese: a slow change toward something richer, never
  toward something alarming. No number or red on the row. It stops changing after a few weeks.
  Hovering it, or focusing it from the keyboard, shows the start day and the count: "Since
  Mon 28 Sep · 5 days". Age counts from the day the todo was written on.
- **Steps travel with it**, fold state included.
- **From another day:** sticking a todo on a past day moves it to today at once; on a future day it
  stays there and starts travelling when that day comes.
- **Delete** works as it does today, with six seconds to undo.

Not a cap of 3: chosen against, to see how no limit plays out. Not repeating on every day it passes
through: every past day would keep an open ring. Not replacing "move to tomorrow": both stay. Not
drag to a shelf: an empty shelf is hard to find.

## Open

- **The age picture.** Sketch a few in the maturing spirit and choose on a real row.
- **The row button's icon.**
- **The README's first promise**, "Every day starts empty. Nothing rolls over.", needs an honest
  rewrite.

## Done when

- A todo made sticky on Monday shows on Friday's card after four days with the app closed, and
  Monday no longer has it.
- Today shows Cleared with an open sticky on it.
- Its age is visible without a number, and hover or focus shows the start day and the day count.
- `features.md`, the README and `CHANGELOG.md` describe it.
