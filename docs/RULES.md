# Ledger business rules

Every rule here gets a pytest test.

## Entry status

- **disputed**: any review has verdict `"dispute"`.
- **confirmed**: no disputes AND confirms >= `ceil((team_size - 1) / 2)`.
- **pending**: otherwise.
- Only confirmed entries count toward progress.

## Points

- Entry size: `S = 1`, `M = 2`, `L = 4`.
- Charter `planned_points` use the same scale.

## Time

- `t = (now - start_date) / (due_date - start_date)`, clamped to `0..1`.
- `now` always comes from the clock service (`backend/app/services/clock.py`); a demo override is allowed.
- List endpoints hide any record with `created_at > now`. This lets the demo time slider replay the story.

## Expected vs actual

Computed per member, at time `t`.

- For each charter item:
  `expected = planned_points * clamp((t - start_pct) / (end_pct - start_pct), 0, 1)`
- Member `expected` = sum of their items' expected.
  Member `actual` = sum of their confirmed entry points.
- If `expected < 1`: status = `"not_started_yet"` (never flagged).
- `progress_ratio = actual / expected`
- `team_median` = median `progress_ratio` of members with `expected >= 1`.
- A member is **BEHIND** if any of:
  - `progress_ratio < 0.5 * team_median`
  - `progress_ratio < 0.25` (catches a whole-team stall)
  - `actual == 0 AND expected >= 2`

## Checkpoints and escalation

- Checkpoints come from the assignment (default `0.33, 0.66`).
- Each checkpoint is evaluated once per team, the first time `t` passes it.
- Evaluation is lazy: run any due checkpoints whenever contribution, alerts or overview is requested, and whenever demo time changes.
- A checkpoint is judged as of its own moment: `t = checkpoint`, counting only entries and reviews created up to the checkpoint's datetime. The alert's `created_at` is that datetime. So jumping demo time past several checkpoints evaluates each one fairly.
- Only locked charters are evaluated.
- For each member at a checkpoint:
  - **behind**: `streak += 1`, create an alert whose level depends on the streak:
    - `1` = `"private"`
    - `2+` = `"team"`
  - **not behind**: `streak = 0`, mark that member's open alerts resolved.

## Alert visibility

- **private**: only the member it is about.
- **team**: every member of the team.

## Team health (overview)

- **amber**: any disputed entry.
- **green**: otherwise.
- Teachers are never notified: no alert, private or team, affects health or appears on the overview.

## Paste detection

Detected in the frontend, stored by the backend.

- **paste**: pasted text >= 200 characters.
- **burst**: >= 300 characters inserted within 10 seconds without a paste event.
- **is_internal**: the normalised pasted text (lowercase, collapsed whitespace) already exists in the document before the paste.
- `flagged = not is_internal AND label is null`
- Internal events are stored but never shown as warnings.
- Flagged pastes are visible to the whole team immediately. They are separate from the escalation ladder.
