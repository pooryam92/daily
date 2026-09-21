# Daily — backlog

Features that are wanted and not built yet. An entry says what the feature is and why it is wanted,
with the rows of `research.md` it rests on and their sources, so it can be judged without opening
three files. Once built, the entry goes: what was decided then is in `archive.md`. Remove it in the
commit that builds it.

## Move a todo by hand

"Move to tomorrow" on a todo of today, "Move to today" on a todo of any other day. The todo changes
its day and nothing else: no trace that it was moved, and no count of how often.

- **Why move at all.** An unfinished task keeps coming to mind until there is a specific plan for
  it, and the plan does not have to be carried out for that to stop
  ([Masicampo & Baumeister 2011](https://users.wfu.edu/masicaej/MasicampoBaumeister2011JPSP.pdf);
  [`research.md`, section 1](research.md#1-psychology), the five "Plan-making" rows). Giving a todo
  a day is the smallest such plan. The same rows carry two limits: the studies asked for how, when
  and where, and a plan that gives only the when was not tested; and a plan reduces the intrusive
  thoughts, not the anxiety.
- **Why by hand.** Nothing rolls over by itself: every day starts empty, which is what the app is
  built on. A todo that moves on its own is a plan nobody made, and it brings the overdue list back.
  Dropping stays the other way out: the paper names deciding that a goal is no longer pressing as
  another route to closure ("Plan-making: disengaging is another route"; not tested there).
- **Why no trace and no count.** A "moved three times" mark is the overdue badge in another form.
  Red "overdue" styling is reported to cause anxiety
  ([unverified](https://dev.to/vaicurious/why-most-productivity-apps-slowly-become-anxiety-machines-57c1);
  row "Red 'overdue' styling"), and counts that can only get worse work through loss aversion
  ([the streak write-up](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature);
  row "Streaks and loss aversion").

## The checkbox before the text, and words on the right

A row reads `☐ Buy milk ········ drop  delete` instead of `• Buy milk ········ delete ☐ ✗`. The
checkbox takes the bullet's place and stays 28px; the grip appears to its left while the row is
hovered. A dropped todo shows its ✗ inside that same box, and a click on the box reopens it, as
now. `drop` is a word that is always there, in `--text-faint`; `delete` keeps appearing on hover (and
is always there on touch), after a gap. What the three controls do does not change.

- **Why the checkbox goes left.** The left half of a page gets 80% of the viewing time (eye
  tracking, 120+ people,
  [NN/g](https://www.nngroup.com/articles/horizontal-attention-leans-left/)), and the first words of
  each line get more fixations than the later ones
  ([NN/g](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)). A control that is
  far from its text costs the eye time: about 500 ms from a label to a distant field, 170–240 ms to
  one next to it ([Penzo 2006](https://www.uxmatters.com/mt/archives/2006/07/label-placement-in-forms.php);
  [`research.md`, section 3](research.md#3-interaction-guidelines), the "Attention" rows). Things 3
  and TickTick both work through a checkbox before the text and show a cancelled task as an X in
  it ([section 2](research.md#2-what-other-apps-do); the TickTick row is unverified), and people
  expect what they know (row "Convention"). The limit: all of this was measured on web pages and
  forms. No study of a to-do's checkbox before or after its text was found (section 8).
- **Why a word and not ✗.** An X means cancel, close or dismiss elsewhere, so "users cannot rely on
  any single interpretation" ([NN/g](https://www.nngroup.com/articles/cancel-vs-close/)), and next
  to `delete` the row seems to have two ways to remove a todo. Outlook 98's toolbar went unused
  until its buttons were labelled; new icons and new positions had not helped
  ([Jensen Harris](https://learn.microsoft.com/en-us/archive/blogs/jensenh/the-importance-of-labels)).
  Icon-only buttons did much worse in a first session and caught up in the second (Wiedenbeck 1999,
  unverified), so the gain is largest in the first days (the "Icons" rows).
- **Why `drop` is always there and `delete` is not.** Navigation hidden behind an icon was used in
  27% of desktop tasks against 48% when visible, and tasks took at least 39% longer (179
  participants, [NN/g](https://www.nngroup.com/articles/hamburger-menus/); row "Hidden controls").
  That is about navigation, not about row actions on hover, but it points one way: what should be
  used has to be seen. Dropping is meant to be used: being able to let go of a goal goes with
  higher well-being (Wrosch et al. 2003, unverified; section 1). Deleting is rare and can be
  undone, and two inline actions are as many as a row carries ("Row actions", first row).
- **Why `delete` leaves the checkbox's side.** "Avoid placing highly consequential actions…
  directly next to options that are benign"
  ([NN/g](https://www.nngroup.com/articles/proximity-consequential-options/)). Today it appears on
  hover right beside the most-used control in the app.
- **What must not change.** The box stays 28px or larger: the size of a target affects the error
  rate more than its distance does
  ([Wobbrock et al. 2008](https://www.microsoft.com/en-us/research/publication/an-error-model-for-pointing-based-on-fitts-law/);
  the "Pointing" rows). Dropped stays neutral, never red.
