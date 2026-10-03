# Ledger API contract

Source of truth for data models shared by backend and frontend.
Do not change field names without updating this file.

Conventions:
- All timestamps are ISO 8601 strings in UTC, returned with a `Z` suffix. Input without a timezone is treated as UTC.
- Validation errors return `422`, missing resources return `404`.
- `*_pct` values are fractions of the project timeline, `0.0`–`1.0`.
- List endpoints hide any record with `created_at > now` (see [RULES.md](RULES.md#time)).

## Models

### Assignment

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `title` | string | |
| `start_date` | datetime | |
| `due_date` | datetime | |
| `join_code` | string | |
| `checkpoints` | float[] | Default `[0.25, 0.5, 0.75]` |

### Team

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `assignment_id` | int | |
| `name` | string | |
| `charter_locked` | bool | Only locked charters are evaluated |

### Member

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `team_id` | int | |
| `name` | string | |

### CharterItem

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `team_id` | int | |
| `member_id` | int | |
| `responsibility` | string | |
| `planned_points` | int | Same scale as entry size (S=1, M=2, L=4) |
| `start_pct` | float | `0.0`–`1.0` of the project timeline |
| `end_pct` | float | `0.0`–`1.0` of the project timeline |

### Entry

Append-only. No update or delete.

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `team_id` | int | |
| `member_id` | int | |
| `description` | string | |
| `size` | `"S"` \| `"M"` \| `"L"` | |
| `charter_item_id` | int \| null | |
| `evidence` | [Evidence](#evidence)[] | |
| `created_at` | datetime | |
| `status` | `"pending"` \| `"confirmed"` \| `"disputed"` | Derived, see RULES.md |
| `reviews` | [Review](#review)[] | |

### Evidence

| Field | Type | Notes |
|---|---|---|
| `kind` | `"url"` \| `"file"` \| `"doc_activity"` \| `"commit"` | |
| `ref` | string | |
| `label` | string | |

### Review

Append-only. No update or delete.

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `entry_id` | int | |
| `reviewer_id` | int | |
| `verdict` | `"confirm"` \| `"dispute"` | |
| `note` | string | |
| `created_at` | datetime | |

### Document

One shared document per team.

| Field | Type | Notes |
|---|---|---|
| `team_id` | int | |
| `content_html` | string | |
| `content_text` | string | |
| `updated_at` | datetime | |
| `updated_by` | int | Member id |

### PasteEvent

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `team_id` | int | |
| `member_id` | int | |
| `kind` | `"paste"` \| `"burst"` | |
| `char_count` | int | |
| `preview` | string | First 120 chars |
| `is_internal` | bool | Text already existed in the doc |
| `label` | null \| `"my_notes"` \| `"quote"` \| `"moved"` \| `"other"` | |
| `label_note` | string | |
| `flagged` | bool | `true` when not internal and unlabelled |
| `created_at` | datetime | |

### Alert

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `team_id` | int | |
| `member_id` | int | |
| `checkpoint` | float | |
| `level` | `"private"` \| `"team"` \| `"teacher"` | |
| `reason` | string | |
| `created_at` | datetime | |
| `resolved` | bool | |

### Contribution

Computed per member, not stored.

| Field | Type | Notes |
|---|---|---|
| `member_id` | int | |
| `name` | string | |
| `expected_points` | float | |
| `actual_points` | float | |
| `progress_ratio` | float \| null | `actual / expected`; `null` when `expected_points < 1` |
| `status` | `"not_started_yet"` \| `"behind"` \| `"on_track"` | See RULES.md |

## Endpoints

### Health

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | | `{"ok": true}` |

### Assignments and teams

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/assignments` | `{title, start_date, due_date, checkpoints?}` | `201` AssignmentDetail |
| GET | `/api/assignments/{id}` | | AssignmentDetail |
| GET | `/api/join/{join_code}` | | AssignmentDetail (code is case-insensitive) |
| POST | `/api/assignments/{id}/teams` | `{name}` | `201` [Team](#team) |
| POST | `/api/teams/{id}/members` | `{name}` | `201` [Member](#member) |
| GET | `/api/teams/{id}` | | TeamDetail |

- `POST /api/assignments`: `due_date` must be after `start_date`. `checkpoints` are optional, each must be strictly between 0 and 1, and they are stored sorted. The server generates a 6-character `join_code` from `A–Z` and `2–9`, leaving out the look-alike characters `0`, `O`, `1` and `I`.
- **AssignmentDetail** = [Assignment](#assignment) fields + `join_url` (`http://localhost:5173/join/{join_code}`) + `teams: Team[]`.
- **TeamDetail** = [Team](#team) fields + `members: Member[]` + `charter_items: CharterItem[]`.

### Charter

| Method | Path | Body | Response |
|---|---|---|---|
| PUT | `/api/teams/{id}/charter` | `{items: [{member_id, responsibility, planned_points, start_pct, end_pct}]}` | TeamDetail |
| POST | `/api/teams/{id}/charter/lock` | | TeamDetail |

- PUT replaces the whole charter. Replaced items get new ids.
- Rule violations return `400` with a `detail` message such as `"Charter item 2: planned_points must be greater than 0"`. If any item is invalid, nothing is saved. The rules:
  - `0 <= start_pct < end_pct <= 1`
  - `planned_points > 0`
  - `responsibility` is not blank
  - `member_id` belongs to this team
  - the charter is not locked
- Lock returns `400` if the charter is empty or already locked. A locked charter cannot be unlocked.

### Ledger

Append-only. There are no update or delete endpoints for entries or reviews.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/teams/{id}/entries` | `{member_id, description, size, charter_item_id?, evidence?: [{kind, ref, label?}]}` | `201` [Entry](#entry) |
| GET | `/api/teams/{id}/entries` | | [Entry](#entry)[], newest first |
| POST | `/api/entries/{id}/reviews` | `{reviewer_id, verdict, note?}` | `201` the updated [Entry](#entry) |

- `created_at` is always set by the server from the clock. Clients never send it.
- GET hides entries with `created_at > now`. Each entry includes only reviews with `created_at <= now`, and `status` is computed from those reviews, so moving demo time back replays the history.
- Entry rules (`400` on violation):
  - `member_id` is in the team
  - `description` is not blank
  - `size` is `S`, `M` or `L`
  - each evidence item has a valid `kind` and a non-blank `ref`
  - `charter_item_id`, if given, belongs to the team, and the charter must be locked
- Review rules (`400` on violation):
  - the reviewer is in the entry's team and is not the author
  - `verdict` is `confirm` or `dispute`
  - a dispute needs a non-blank `note`
  - one review per reviewer per entry, ever. Reviews that are hidden by demo time still count.
- Reviewing an entry that doesn't exist or is hidden by demo time returns `404`.

### Document and pastes

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/teams/{id}/document` | | [Document](#document) (created empty on first GET) |
| PUT | `/api/teams/{id}/document` | `{member_id, content_html, content_text}` | [Document](#document) |
| POST | `/api/teams/{id}/pastes` | `{member_id, kind, char_count, preview, is_internal, label?, label_note?}` | `201` [PasteEvent](#pasteevent) |
| GET | `/api/teams/{id}/pastes` | | [PasteEvent](#pasteevent)[], newest first |
| PATCH | `/api/pastes/{id}/label` | `{member_id, label, label_note?}` | [PasteEvent](#pasteevent) |

- Document PUT overwrites the whole document. The server sets `updated_at` to now and `updated_by` to `member_id`. `member_id` must be in the team (`400`).
- Paste POST:
  - The frontend detects pastes and bursts and decides `is_internal`. The backend trusts that and doesn't recheck the 200/300-character thresholds.
  - The server cuts `preview` to 120 characters, sets `created_at` to now and computes `flagged = not is_internal and label is null`.
  - `400` if the member isn't in the team, `kind` isn't `paste`/`burst`, `label` isn't one of the allowed values, or `char_count` is negative.
- Paste GET returns only events that are not internal and have `created_at <= now`.
- Label PATCH:
  - Only the member who pasted may label (`403` otherwise). `label` must be `my_notes`, `quote`, `moved` or `other` (`400`).
  - Labelling sets `flagged = false`.
  - A paste that doesn't exist or is hidden by demo time returns `404`.

### Contribution and alerts

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/teams/{id}/contribution` | | `{t, team_median, members: Contribution[]}` |
| GET | `/api/teams/{id}/alerts?viewer_id={member_id}` | | [Alert](#alert)[], newest first |

- Both endpoints first run any checkpoints that are due (see RULES.md). `POST /api/demo/time` also runs them for every team.
- Contribution is computed at the current `t` from entries and reviews with `created_at <= now`. `team_median` is `null` when no member has `expected_points >= 1`.
- Alerts:
  - `viewer_id` is required (`422` if missing) and must be a member of the team (`400` otherwise).
  - The viewer sees `team` alerts plus `private` alerts about themselves.
  - Only alerts with `created_at <= now` are returned. An alert's `created_at` is the moment of its checkpoint.
  - Resolved alerts are included, with `resolved: true`.

### Demo time

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/demo/time` | | `{now, overridden}` |
| POST | `/api/demo/time` | `{now: datetime \| null}` | `{now, overridden}` |

- `now: null` clears the override and returns to real UTC time.
- After changing the time, runs due checkpoint evaluation for every team with a locked charter.
