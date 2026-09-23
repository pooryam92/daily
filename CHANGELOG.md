# Changelog

What changed for someone using Daily, newest first. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/pooryam92/daily/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/pooryam92/daily/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/pooryam92/daily/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pooryam92/daily/releases/tag/v1.0.0
