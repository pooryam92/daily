# Daily — backlog

Features that are wanted and not built yet. An entry says what the feature is and why it is wanted,
with the rows of `research.md` it rests on and their sources, so it can be judged without opening
three files. Once built, the entry goes: what was decided then is in `archive.md`. Remove it in the
commit that builds it.

## Steps on a todo

- **What.** A todo can hold steps: one level of todos nested under it, shown indented on the card
  with a smaller box, and a count such as `1/3` after the parent's text. Wireframes, one board per
  state with a note on the rule it draws and a sources note:
  https://claude.ai/artifact/CdsxWGqZSUdhN1GNtmZ8rG.
- **Why.** A todo written as one line often turns out to be several ("set up CI" is a workflow file,
  a lint fix and a cache), and today the choices are to let the line grow, to add siblings that
  clutter the day, or to keep the list in one's head. Breaking a goal into specific steps is the
  plan that stops it intruding (Masicampo & Baumeister 2011; Gollwitzer 1999), each step is a small
  win (Amabile & Kramer 2011), and a count nearing its end speeds the last steps (Kivetz, Urminsky &
  Zheng 2006).
- **The stored shape.** A step is the same `Todo` type, in an optional `steps` list on its parent.
  No `steps` key means none, so `version` stays 1 and old files load unchanged. The depth of one is
  enforced in `parseStoreData`, not in the type: lifting it later changes the parser, not the file.
  An older app version opening a file with steps drops them silently; the per-version backup
  covers that, and the release notes should say so.
- **Rules.** Done flows down, not up: finishing the parent finishes its steps; finishing every step
  leaves the parent open. The ring counts top-level todos only. Steps do not settle: they strike
  through where they are, and only the top level runs through `displayOrder`. A moved parent takes
  its steps; a deleted parent takes its steps, and undo brings them all back. Drop stays gone: a
  step that will not be done is deleted. No fold state is stored: an open parent shows its steps, a
  done parent shows one line with its count.
- **UI.** Steps are a nested `<ul>` inside the parent's `<li>`, indented 32px so the step's box sits
  under the parent's text, with the same 28px hit height, the same grip, `delete` on hover and no
  `tomorrow`. The one way in is the editor: click the parent's text, and the word `step` sits at
  the end of the field, where `delete` once lived; it commits the text and opens an empty step
  editor beneath. Enter in a step editor commits it and opens the next; Escape, or a click
  elsewhere on an empty one, adds nothing. Steps reorder by drag within their parent, by pointer
  and by keyboard.
- **Deferred.** Keyboard indent (Tab has to keep moving focus, and the todo apps' Ctrl+] needs
  bracket keys); drag sideways to nest or un-nest (rows are locked to the vertical axis, and it is
  the only way to promote a step, which until then is deleted and re-added); a chevron to fold an
  open parent (if added, remember the choice per todo).
- **Build order.** Domain and parser with tests; steps rendered read-only with toggle and delete;
  adding through the editor and Enter; step reorder; then the deferred pieces. Traps already in
  the code: the layout key in `day/DayCard.tsx` joins top-level ids only; its `initialIds` is top
  level only, so loaded steps would animate in; its drop handler resolves the target from the
  top-level order, so step sortables need the parent id as their type; `todos/TodoEditor.tsx`
  keeps the old text when emptied, which is wrong for a draft step; undo of a deleted step needs
  the parent id on `restored`.
- **Docs.** A Steps section in `features.md`, a `CHANGELOG.md` line, an e2e test of the
  editor-and-Enter flow under xvfb.
- **Rests on** (`research.md`, read 2026-09-30): inline row actions are one or two
  ([NN/g](https://www.nngroup.com/articles/data-tables/)); show up front what is needed often, two
  disclosure levels at most ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/));
  counts over percentages ([NN/g](https://www.nngroup.com/articles/progress-indicators/)) in
  tabular numerals ([Rauno](https://interfaces.rauno.me/)); add a step lives inside the opened task
  ([Microsoft To Do](https://support.microsoft.com/en-us/todo/add-steps-importance-notes-tags-and-categories-to-your-tasks),
  [Things](https://culturedcode.com/things/support/articles/2785159/)); a depth of one
  ([Google Tasks](https://workspace.google.com/blog/product-announcements/upcoming-change-google-tasks-api),
  [Things](https://culturedcode.com/things/support/articles/8491676/)); a done parent completes its
  subtasks
  ([Reminders](https://support.apple.com/guide/reminders/add-subtasks-to-reminders-remn32a9622b/mac))
  and done steps leave the task open
  ([Microsoft To Do](https://support.microsoft.com/en-US/ToDo/what-s-new-in-microsoft-to-do)); a
  mixed checkbox is select-all semantics
  ([WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)); Tab must leave a component
  ([WCAG 2.1.2](https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html)); plan-making,
  small wins and the goal gradient (section 1).
