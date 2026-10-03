# Engineering Notebook Evidence — Future Ideas

Things noticed while building the evidence signals and Team Growth. **None of
these are built.** Written down so they aren't lost and aren't silently added.

## Asked for during the build, deliberately deferred

- **Let members read each other's notebook entries.** Right now a member sees
  only their own, everywhere — notebook, profile, Team Growth. People want to
  read the rest of the team's. This is a permissions change, not a feature
  toggle: it needs a decision on whether entries are team-readable by default,
  whether a member can opt an entry out, and whether engagement notes (which
  are personal — "I felt lost today") travel with them. Worth doing, worth
  deciding deliberately rather than bundling into this.

## From the spec, explicitly out of scope for now

- **Award evidence mapping.** The data now exists to support it. The spec says
  not to score, rank, or predict awards yet, and that remains right: a number
  that decides an award changes how people answer the question.
- **Turning "what should happen next" into a task.** Stored, not wired. A
  half-formed "we should probably retest this" is worth writing down long
  before it is worth assigning to anybody.

## Noticed while building

- **Signal counts per member are deliberately not shown.** Team Growth filters
  by member but never ranks them. If that ever changes it should be a conscious
  decision — the fastest way to make this data worthless is to let people see
  it is being scored.
- **"Not sure yet" answers are worth reading on their own.** Several questions
  have one, and a rise in them is a real signal (new skill, new subsystem)
  rather than a gap in the data.
- **Confidence over time, per skill.** The data supports asking whether someone
  who was "just introduced to it" in September reports "I could teach someone
  else" by February. That is the most interesting question in here, and it
  needs more than one season of data.
- **Entries with signals but empty follow-ups.** Harmless, but a lot of them
  would mean the questions are being skipped and the prompts need rewording.
- **The old `mentor_help` field now overlaps the `help` signal.** Both record
  "a mentor helped me". Worth reconciling eventually; left alone because
  historical entries depend on `mentor_help` and the Mentor log reads it.
