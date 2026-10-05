# Changelog

What changed for someone using Daily, newest first. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sticky todos. The pin at a todo's end carries it: until it is done it moves to today every
  morning, steps and all, and waits at the bottom of the card under "Carried". A thin ribbon beside
  it ripens over four weeks; point at it to see since when. An open sticky does not hold the day's
  ring open, and a ticked one is a normal done todo on that day. Going back to an older version of
  Daily loses which todos were sticky.

## [1.3.0] - 2026-10-04

### Added

- Steps on a todo. Click "Add a step" at a todo's end to write steps under it, and the row under
  its last step to add more; Enter adds the next one, and Escape stops. An arrow before the todo's
  checkbox folds the steps away, and shows them again. Folded, the todo's text ends with how many
  are done, like `1/3`. Each todo keeps its fold.
  Checking the todo checks its steps and folds them; checking every step leaves the todo for you to
  check, and unchecking a step reopens it. A checked step stays where it is. Steps are edited,
  deleted with Undo, and dragged by mouse or keyboard, and they move with their todo. Drop a todo on
  another to make it a step, or between steps to put it there; drop a step between todos to make it
  a todo again (→ and ← during a keyboard drag). Going back to an older version of Daily loses the
  steps and their folds: it opens the todos without them, and saves them that way.

### Changed

- Dragging a todo no longer pushes the other rows aside. A small copy follows the pointer and a
  line shows where it will land. The list scrolls while the pointer is held past its edge, and
  letting go outside the list cancels.
- A todo whose text runs over several lines keeps its box and buttons beside its first line,
  instead of centred on the whole text.
- A row at rest shows only its box and its text. Pointing at it, or focusing it, shows its buttons
  at the end, one click each: add a step and move to tomorrow (or to today), then delete, always
  last and set apart, in the same place on every row. Each is named in a small tip. Nothing moves
  when they appear. On touch they are always there. Right-click on a row, or Shift+F10 or the
  context menu key on a focused one, opens the same actions as a menu. The `tomorrow` and `delete`
  words are no longer on the row, and the editor no longer has a `delete`: Delete on a focused todo
  deletes it.
- After Move or Delete from the keyboard, the focus goes on to the next row.
- A new row, or one just dropped, scrolls clear of the list's faded edge.
- The grip for reordering is gone. A todo is dragged by its text or any empty part of its row, as
  before; from the keyboard, Space on its focused text picks it up, and Enter still edits it.
- The card is wider, up to 840px, so a todo's text has more room. The arrow buttons sit on the day
  before and the day after, the days they go to.

### Removed

- Dropping a todo. A todo is open or done; one that will not be done is deleted or moved. Todos
  dropped in an older version show as done.
  The falling note for a drop is gone with it; a tick and the chord remain.

### Fixed

- A screen reader hears the todo's text while it is dragged, not an internal id.
- A todo dragged with the pointer off to one side no longer jumps a place it was not moved to.

## [1.2.0] - 2026-09-24

### Changed

- The `.deb` and the `.rpm` update themselves. The update downloads in the background, and Restart
  installs it after your password. Installs of 1.1.0 or older still need this one update by hand.

## [1.1.0] - 2026-09-23

### Added

- A todo can be moved by hand: "→ tomorrow" on an open todo of today, "→ today" on one of any
  other day. It lands at the end of that day's list, and a toast offers Undo for six seconds.

### Changed

- The row reads checkbox first, then the text, then `drop` at the end. A dropped todo shows an X
  inside its checkbox instead of a separate ✗ button.
- `delete` moved from the row into the editor: click a todo's text, then `delete` after the field.
- The grip for reordering appears to the left of the checkbox while the row is hovered.
- A todo is dragged by any part of its row, not only its grip. A click on the text still edits it,
  but the text can no longer be selected with the mouse.

### Fixed

- Deleting the last open todo of a day clears it quietly again, without the ring's celebration.

## [1.0.1] - 2026-09-22

### Changed

- A two-finger swipe goes the other way: to the right brings the day after, to the left the day
  before.

## [1.0.0] - 2026-09-21

The first release.

### Added

- One card per day. Every day starts empty and nothing rolls over; the day before and the day after
  peek out behind today, and any day can be reached with the arrow keys, the arrow buttons, a drag
  or a two-finger swipe.
- Todos that are open, done or dropped. Add, edit in place, reorder by dragging or from the
  keyboard, and delete with six seconds to undo.
- A progress ring per day that closes into "Cleared" when the last open todo is resolved.
- Light and dark themes, following the system or set by hand, and optional sounds.
- Todos and settings saved on this machine in readable JSON files, with a backup of the todos at the
  first start of each new version.
- Installers for Windows, macOS (Apple silicon and Intel) and Linux (AppImage, `.deb`, `.rpm`).
- Updates: the Windows install and the AppImage update themselves; the other installs say when a new
  version is out.

[unreleased]: https://github.com/pooryam92/daily/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/pooryam92/daily/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/pooryam92/daily/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/pooryam92/daily/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/pooryam92/daily/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pooryam92/daily/releases/tag/v1.0.0
