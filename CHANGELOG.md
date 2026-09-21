# Changelog

What changed for someone using Daily, newest first. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/pooryam92/daily/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/pooryam92/daily/releases/tag/v1.0.0
