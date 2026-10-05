# Daily — features

What the app does, as someone using it meets it. One section per feature: what it is, how it is
used, and the behaviour that is easy to get wrong when changing it. Why it was built this way is
in `archive.md` and `architecture.md`.

Keep it current: a change to what the user can do changes this file in the same commit.

## Days

- **One card per day.** The app opens on today. Every day starts empty apart from the todos you
  chose to carry (see Sticky todos); nothing else rolls over, and yesterday's other open todos stay
  on yesterday's card.
- **The title is what the day is called out loud:** "Today", "Yesterday", "Tomorrow", otherwise the
  weekday. The line under it has the date, and for a day titled by its weekday also how far from
  today it is. Only "Today" is in the accent colour.
- **The day before and the day after peek out** behind the front card, as a tab with the date and
  one wordless bar per todo. Their text is not readable on purpose. The arrow buttons sit on them.
- **Midnight.** While the app shows today, it follows the date: after midnight the front card is the
  new day. A day that was navigated to stays where it is. The date is checked every minute and
  whenever the window gets focus.

## Moving between days

| How                         | What happens                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| `←` / `→`                   | The day before / after. A held key flips without animation.         |
| The arrow buttons           | The same, with the full spring.                                     |
| Click a card behind         | That day comes to the front.                                        |
| Drag the front card         | It follows the pointer; past half a day, or on a flick, it flips.   |
| Two-finger swipe (trackpad) | One flip per gesture, only when the movement is clearly sideways.   |
| "Back to today"             | A pill over the deck, shown on any other day. One flip, however far |

- The arrow keys move the cursor instead while there is text to move through: in a todo that is
  being edited, and in the add-todo input once something is typed. They also belong to a todo
  picked up from the keyboard (see Reorder).
- A swipe points at the day it goes to, like the arrow keys: to the right is the day after. A drag
  is the other way round, because there the card follows the pointer.
- A drag of the deck cannot start on a todo's row, which is dragged on its own (see Reorder). A drag
  moves one day at most.
- Every way of moving can interrupt every other one: they all move the same value.

## Todos

- **Add.** The input at the bottom of the front card has the focus whenever the day changes. Enter
  adds the todo; blank text adds nothing. Todos can be added to any day, past or future.
- **Done or open.** The checkbox before the text marks a todo done; the same click reopens it.
  There is no third state. A todo that will not be done is deleted, or moved to a day it will be.
- **Settling.** A resolved todo moves below the open ones after 700ms of quiet, and a reopened one
  waits the same before it goes back up, so a mis-click is undone in place. Only the display order
  changes; the stored order does not.
- **Move.** The calendar at the row's end, "Move to tomorrow" on an open todo of today, "Move to
  today" on an open todo of any other day. The todo changes its day and nothing else:
  it lands at the end of that day's list, and nothing records that it moved. The deck stays put. A
  toast offers Undo for six seconds.
- **Edit.** Click a todo's text, or activate it from the keyboard. The row becomes the field; the
  row's buttons step aside. Enter or clicking away saves, Escape cancels. A blank edit keeps
  the original text. The state is kept.
- **Reorder.** Drag a todo by its text or any empty part of its row: it lifts after a few pixels
  of movement, so a click on the text still edits it. There is no grip. On touch, hold the row for
  a moment first. The checkbox, the fold arrow, the row's buttons and the row for adding a step
  keep their presses.
  Nothing moves while you drag: the row stays in place, dimmed, a small copy of it follows the
  pointer, and a line shows where it will land. Over the top or bottom quarter of a row, the line
  is above or below it. Open todos and done ones are dragged among their own kind. The list scrolls
  while the pointer is held past its top or bottom edge, and letting go outside the list cancels.
  From the keyboard: on the focused text, Space picks the todo up (Enter still edits), the arrow
  keys move it, Space or Enter drops it, Escape cancels, and the keyboard stays on its text. The
  order is saved.
- **Delete.** The bin, always at the very end of the row. From the keyboard, Delete
  (or Backspace) on the focused text does the same. It never asks: the todo is gone and
  saved as gone at once, and a toast offers Undo for six seconds. Undo puts it back where it was.
- **Long text wraps** across the row. The box, the fold arrow and the row's buttons stay beside
  the first line.
- **The row's end.** Where there is a mouse a row at rest is its box and its text, with a faint ›
  before the box if its steps are folded. Pointing at the row, or giving it the keyboard focus, shows
  its buttons, one click each, in room the row keeps for them, so nothing moves: on an open todo a
  pin (carry until done), a list with a + (add a step, on a todo without steps or a folded one) and
  a calendar (move), then,
  set apart at the very end, a bin (delete). The calendar and the bin are in the same place on
  every row; on a done todo and on a step the bin is the only button. Each names itself in a small tip after a moment's pointing, or at once from the
  keyboard. On touch they are always there. Right-click on the row, Shift+F10 or the menu key open
  the same actions as a menu, with "Hide steps" or "Show steps" on a todo with steps; a click
  outside it only closes it. After Move or Delete the keyboard goes to the next row, else the one
  before, else the input. After a click on Move or Delete the buttons wait for the pointer to
  move, so a double-click takes one row, not the one that slides up under it.

## Steps

- **What.** A todo can hold steps: one level of todos under it, indented so each step's box sits
  under the todo's text, with a smaller box. A step cannot have steps.
- **Add.** On a todo without steps, click "Add a step", the list with a + at the row's end. Once
  it has steps, the row under its last step adds more: pointing at the todo, or focusing it, shows
  the same small icon there, and pointing at that row shows "Add a step" across it, all of it one
  target (on touch the icon is always there). A folded todo keeps "Add a step" at the row's end.
  An empty step editor opens under the todo's steps, "First step…" or "Next step…". Enter adds
  the step and opens the next one; Enter on an empty one, or Escape, closes it and adds nothing, and the
  keyboard is back where it was opened from. Leaving it, by click or by Tab, adds what was typed. A
  folded todo unfolds first. While it is open, the row's buttons step aside. A done todo
  has no "Add a step".
- **Fold.** A todo with steps has an arrow at the left of its row, before the checkbox, where a
  drag grip used to be: a faint › while its steps are folded, and a ⌄ when they show, which
  appears only when the row is pointed at or focused (on touch the arrow is always there). It is a
  button, "Hide steps" or "Show steps". Click it, or press Enter or Space on it, to hide the
  steps, and again to show them; a click on the folded count shows them too. Open or done, each
  todo keeps its fold, across restarts too. Clicking the text still opens the editor.
- **How far.** Shown, the steps' own boxes say how far the todo is. Folded, the count follows the
  todo's text, like `1/3`, so the hidden steps and how far they are both show; a dragged todo's
  copy carries it too. It turns green when every step is done and the todo is still open, and is
  faint on a done todo. A screen reader hears "1 of 3 steps done".
- **Done flows down, not up.** Checking a todo checks all its steps. Checking every step leaves the
  todo open: checking it is still yours to do. Reopening a todo leaves its steps done.
- **Checking a todo folds it** to one line, with its count; reopening it leaves the fold as it is.
  Writing a new step, or undoing a step's delete, unfolds it.
- **A done todo never has an open step.** Unfold it, and its steps can be checked, edited and
  deleted. Unchecking one reopens the todo, as does putting an open step back under it with Undo.
- **Steps do not settle.** A done step is struck through where it is. Only todos settle.
- **On a step's row:** its box, its text (click to edit, as for a todo), and on hover the bin; it has no move: a step goes wherever its todo goes.
- **Delete.** The bin, or Delete on the focused text. The toast says "Step deleted", and Undo puts
  the step back in its place. Deleting a todo deletes its steps, and Undo brings them all back.
- **Drag between levels.** Steps are dragged like todos, by pointer or keyboard, and a todo takes
  its steps along.
  - Drop a todo on the middle of another: it becomes that todo's last step, and a folded todo
    unfolds.
  - Drop a row between steps, or just under a todo whose steps show: it becomes a step there. A
    short gap under an open todo's steps leaves room to drop just after the last one.
  - Drop a step between todos: it becomes a todo there.
  - The line's indent shows which it will be, and the todo the row will belong to is tinted.
  - From the keyboard, → makes the row a step of the todo above, and ← makes a step a todo, just
    after the one it was under. After the drop the keyboard is on the row's text.
  - A todo with steps of its own stays a todo: the line keeps to the gaps between todos.
  - A step keeps its status when it comes out. An open row put under a done todo reopens it.
- **The ring and the sounds count todos only.** Checking a step ticks; it never clears the day.

## Sticky todos

- **What.** A todo you choose to carry. It moves to today every morning until it is done; every
  other todo stays on its day.
- **Stick and unstick.** The pin at the row's end, first among its buttons, or "Carry until done" /
  "Stop carrying" in the row's menu. Its tip says "Carry until done". Pressed, the pin stays in the
  ribbon's ripest colour. Only an open todo has it; its steps travel with it, fold included.
  Unsticking leaves a normal open todo at the end of today's own todos.
- **Where it sits.** Under the day's own todos, at the bottom of the card, under a quiet "Carried".
  It takes the room the day's own todos leave; when both lists are full it keeps 40% of the height,
  and each scrolls on its own. Stickies are dragged
  among themselves; nothing is dropped across the line between the two lists. Sticking or unsticking
  from the keyboard puts the focus on the todo's text in its new list.
- **It travels.** An open sticky on a day before today moves to the end of today's carried todos,
  oldest day first, on start and when the date changes while the app is open. The days it passed
  keep no trace of it. Stuck, or a done sticky reopened, on a past card, it slides off towards today
  at once; stuck on a future
  card, it waits there and travels once that day is today. "Move to tomorrow" works the same way.
- **Age.** A thin ribbon in the margin beside its box ripens from pale straw to cognac (in the dark,
  khaki to honey) over four weeks, then stays. There is no number on the row. Pointing at the ribbon
  or the pin, or focusing the pin, shows "Since Mon, Sep 28 · 5 days", "Since today", or on a future
  card "From Sat, Oct 10". The age counts from the day the todo was on when it was stuck.
- **Done.** Ticking it makes it a normal done todo on that day: it stays in the section, struck
  through and without a ribbon, and counts in the day's ring. Unticked the same day, it is carried
  again. A done sticky never travels. A past card shows one list: a done sticky there is a done todo.
- **Outside the ring.** An open sticky does not hold the ring open: today can read Cleared while
  you still carry something.
- **Delete** works as for any todo, with Undo for six seconds; Undo puts it back on today.
- No limit on how many.

## Progress and the cleared day

- **A ring in the card's header** shows how close the day is to having nothing open. There is no
  count. A done todo advances it; an open sticky todo is not counted. A day without todos has no ring. The cards behind
  show a smaller ring on their tab.
- **Cleared.** Resolving the last open todo closes the ring into a check and adds the word "Cleared".
  The flourish plays once, while it is watched; a day that is already cleared when its card appears
  just shows the check. Deleting the last open todo, or moving it away, clears the day without the
  flourish.
- **Words.** An empty day reads "Nothing planned for today." (or "tomorrow", "yesterday",
  "this day"). An unfinished day gets no words at all.
- A screen reader hears the ring as a progress bar with the text "3 of 5 resolved", and "Cleared"
  from a live region.

## Settings

The gear in the bottom-left corner opens a popover.

- **Theme:** Auto, Light or Dark. Auto follows the operating system, also while the app runs.
- **Sound:** off until switched on. Two synthesised sounds: a tick for a check, which climbs a
  scale over checks in quick succession, and a chord for the cleared day. Reopening, deleting and
  moving are silent.
- **The app's version** is at the bottom of the popover.

Both settings are kept in `settings.json` next to the todos, and the theme is applied before the
window opens, so the app never starts in the wrong colours.

## Your data

- **Where.** `todos.json` and `settings.json` in the app's data folder: `~/.config/daily/` on Linux,
  `%APPDATA%\daily\` on Windows, `~/Library/Application Support/daily/` on macOS. Nothing leaves the
  machine; the app's only network request is the check for a newer version.
- **Saving.** Every change is saved at once, as the whole file, through a temporary file, so a crash
  in the middle of a write cannot damage it. If a save fails, a banner says so until the next one
  succeeds.
- **A file that cannot be read** is moved aside as `todos.json.corrupt-<timestamp>`, and the app
  starts empty instead of overwriting it.
- **Before an update touches it.** The first start of each new version copies the file to
  `todos.before-v<version>.json`. The newest five are kept.
- **One app at a time.** Starting the app while it is open brings the open window to the front.

## Updates

The installed app looks for a newer version when it starts and every four hours.

- **AppImage and Windows.** The new version is downloaded in the background. A toast then says
  "Update ready": Restart installs it now and brings the app back; Later leaves it for the next time
  the app quits. It is installed then either way.
- **`.deb` and `.rpm`.** Downloaded in the background too, and the toast says "Update ready". Restart
  asks for the password, installs the package through the package manager and brings the app back.
  Later leaves it until the next start, when the toast comes back; it is never installed on quit.
- **macOS.** The app only says "Update available", and Download opens the release page: macOS lets
  only an app signed by an Apple developer replace itself, and this one is not.
- The toast stays until it is answered. Being offline, or any other failure, shows nothing.

## Accessibility

- Everything works from the keyboard, including reordering. Every focusable control shows a focus
  ring.
- A screen reader hears a todo's box as "Done, checkbox", checked or not. The fold arrow, before
  the box, is "Steps of <the todo>". The text is "Edit <the todo>" and says how to move it ("Press Enter to
  edit, Space to pick up…"). The row's buttons are "Add a step to <the todo>", "Move <the todo> to
  tomorrow" or "to today", and "Delete <the todo>", in that order after the text, and the step
  editor is "New step". During a
  drag, a screen reader hears the row's text and where it would land, like "Above Buy milk." or
  "Step of Plan the trip, after Book flights."; an arrow key that can't move it says why. The fold arrow
  is "Steps of <the todo>", expanded or collapsed, and is described as "1 of 3 steps done". Folded
  steps are neither focusable nor read out.
- `prefers-reduced-motion` keeps fades and drops movement: a flip is instant, though a drag still
  follows the hand; the cleared day cross-fades.
- `prefers-contrast: more` gets solid borders. Forced colours keep the strike-through.
- Text measures 4.5:1 or more against its background and controls 3:1 or more, in both themes.
