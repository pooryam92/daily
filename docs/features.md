# Daily — features

What the app does, as someone using it meets it. One section per feature: what it is, how it is
used, and the behaviour that is easy to get wrong when changing it. Why a feature looks and moves
the way it does is in `design.md`; why it was built this way is in `archive.md` and
`architecture.md`.

Keep it current: a change to what the user can do changes this file in the same commit.

## Days

- **One card per day.** The app opens on today. Every day starts empty; nothing rolls over, and
  yesterday's open todos stay on yesterday's card.
- **The title is what the day is called out loud:** "Today", "Yesterday", "Tomorrow", otherwise the
  weekday. The line under it has the date, and for a day titled by its weekday also how far from
  today it is. Only "Today" is in the accent colour.
- **The day before and the day after peek out** behind the front card, as a tab with the date and
  one wordless bar per todo. Their text is not readable on purpose.
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
  being edited, and in the add-todo input once something is typed. They also belong to a todo's
  grip while it is focused (see Reorder).
- A drag cannot start on a todo's text with a mouse, so the text stays selectable. A drag moves one
  day at most.
- Every way of moving can interrupt every other one: they all move the same value.

## Todos

- **Add.** The input at the bottom of the front card has the focus whenever the day changes. Enter
  adds the todo; blank text adds nothing. Todos can be added to any day, past or future.
- **Three states.** A todo is open, done (the checkbox) or dropped (the ✗). Marking a todo with the
  state it already has puts it back to open. Dropped is a decision, not a failure: it is neutral,
  not red, and it counts as progress.
- **Settling.** A resolved todo moves below the open ones after 700ms of quiet, and a reopened one
  waits the same before it goes back up, so a mis-click is undone in place. Only the display order
  changes; the stored order does not.
- **Edit.** Click a todo's text, or activate it from the keyboard. Enter or clicking away saves,
  Escape cancels. A blank edit keeps the original text. The state is kept.
- **Reorder.** Drag a todo by its grip, within the open part or the resolved part of the day. From
  the keyboard: focus the grip, Space or Enter picks the todo up, the arrow keys move it, Space or
  Enter drops it, Escape cancels. The order is saved.
- **Delete.** The `delete` button on a row (shown on hover where there is a mouse, always
  otherwise). It never asks: the todo is gone and saved as gone at once, and a toast offers Undo
  for six seconds. Undo puts it back where it was.

## Progress and the cleared day

- **A ring in the card's header** shows how close the day is to having nothing open. There is no
  count. Done and dropped todos both advance it. A day without todos has no ring. The cards behind
  show a smaller ring on their tab.
- **Cleared.** Resolving the last open todo closes the ring into a check and adds the word "Cleared".
  The flourish plays once, while it is watched; a day that is already cleared when its card appears
  just shows the check. Deleting the last open todo clears the day without the flourish.
- **Words.** An empty day reads "Nothing planned for today." (or "tomorrow", "yesterday",
  "this day"). An unfinished day gets no words at all.
- A screen reader hears the ring as a progress bar with the text "3 of 5 resolved", and "Cleared"
  from a live region.

## Settings

The gear in the bottom-left corner opens a popover.

- **Theme:** Auto, Light or Dark. Auto follows the operating system, also while the app runs.
- **Sound:** off until switched on. Three synthesised sounds: a tick for a check, which climbs a
  scale over checks in quick succession; a lower, falling note for a drop; a chord for the cleared
  day. Reopening and deleting are silent.
- **The app's version** is at the bottom of the popover.

Both settings are kept in `settings.json` next to the todos, and the theme is applied before the
window opens, so the app never starts in the wrong colours.

## Your data

- **Where.** `todos.json` and `settings.json` in the app's data folder: `~/.config/daily/` on Linux,
  `%APPDATA%\daily\` on Windows. Nothing leaves the machine; the app's only network request is the
  check for a newer version.
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
- **`.deb` and `.rpm`.** The package belongs to the package manager, so the app only says "Update available";
  Download opens the release page.
- The toast stays until it is answered. Being offline, or any other failure, shows nothing.
- There is no macOS build.

## Accessibility

- Everything works from the keyboard, including reordering. Every focusable control shows a focus
  ring.
- `prefers-reduced-motion` keeps fades and drops movement: a flip is instant, though a drag still
  follows the hand; the cleared day cross-fades.
- `prefers-contrast: more` gets solid borders. Forced colours keep the strike-through.
- Text measures 4.5:1 or more against its background and controls 3:1 or more, in both themes.
