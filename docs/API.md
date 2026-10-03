# Ledger API contract

Source of truth for data models shared by backend and frontend.
Do not change field names without updating this file.

Conventions:
- All paths start with `/api`. IDs are integers.
- All timestamps are ISO 8601 strings.
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
| `progress_ratio` | float \| null | `actual / expected`; `null` when `expected_points` is 0 |
| `status` | `"on_track"` \| `"behind"` \| `"not_started_yet"` | See RULES.md |

## Response shapes

Composite responses used by the endpoints below.

### AssignmentCreated

`Assignment` plus:

| Field | Type | Notes |
|---|---|---|
| `join_url` | string | `http://localhost:5173/join/{join_code}` |

### JoinInfo

| Field | Type | Notes |
|---|---|---|
| `assignment` | Assignment | |
| `teams` | Team[] | |

### TeamDetail

`Team` (including `charter_locked`) plus:

| Field | Type | Notes |
|---|---|---|
| `members` | Member[] | |
| `charter_items` | CharterItem[] | |

### Overview

| Field | Type | Notes |
|---|---|---|
| `assignment` | Assignment | |
| `teams` | TeamOverview[] | |

### TeamOverview

| Field | Type | Notes |
|---|---|---|
| `team` | Team | |
| `members` | Member[] | |
| `health` | `"green"` \| `"amber"` \| `"red"` | red: any open teacher alert; amber: any open team alert or disputed entry; otherwise green |
| `open_disputes` | int | Number of entries with status `"disputed"` |
| `teacher_alerts` | Alert[] | Open alerts with level `"teacher"` |

### DemoTime

| Field | Type | Notes |
|---|---|---|
| `now` | datetime | Current clock value |
| `overridden` | bool | `true` when the demo override is set |

## Endpoints

Errors use FastAPI's shape: `{"detail": "<message>"}`. Validation failures return
400, a missing record 404.

| Method and path | Body | Returns | Notes |
|---|---|---|---|
| `POST /assignments` | `title`, `start_date`, `due_date` | AssignmentCreated | Teacher creates an assignment. 400 unless `due_date > start_date`. |
| `GET /assignments/{id}` | | Assignment | |
| `GET /assignments/{id}/overview` | | Overview | Teacher dashboard: every team with members, health, open disputes and teacher-level alerts. |
| `GET /join/{join_code}` | | JoinInfo | Assignment plus its teams, for the join page. |
| `POST /assignments/{id}/teams` | `name` | Team | Create a team. |
| `POST /teams/{id}/members` | `name` | Member | Join a team. |
| `GET /teams/{id}` | | TeamDetail | Team, members, charter items and `charter_locked`. |
| `PUT /teams/{id}/charter` | `items[]`: `member_id`, `responsibility`, `planned_points`, `start_pct`, `end_pct` | TeamDetail | Replace all charter items. 400 once locked. |
| `POST /teams/{id}/charter/lock` | | TeamDetail | Locks the charter. Early warnings only run for locked charters. |
| `GET /teams/{id}/entries` | | Entry[] | All entries with reviews and computed status, newest first. |
| `POST /teams/{id}/entries` | `member_id`, `description`, `size`, `charter_item_id?`, `evidence[]` | Entry | |
| `POST /entries/{id}/reviews` | `reviewer_id`, `verdict`, `note` | Entry | Returns the entry with its new status. 400 if reviewing your own entry or reviewing twice. A dispute requires a non-empty note. |
| `GET /teams/{id}/document` | | Document | Current shared document; created empty on first GET. |
| `PUT /teams/{id}/document` | `member_id`, `content_html`, `content_text` | Document | Autosave. |
| `POST /teams/{id}/pastes` | `member_id`, `kind`, `char_count`, `preview`, `is_internal` | PasteEvent | Record a paste or burst. |
| `PATCH /pastes/{id}/label` | `member_id`, `label`, `label_note` | PasteEvent | Label a paste. Only the paster may label (403 otherwise). Clears `flagged`. |
| `GET /teams/{id}/pastes` | | PasteEvent[] | All non-internal paste events, newest first. |
| `GET /teams/{id}/contribution` | | Contribution[] | One row per member at the current time. |
| `GET /teams/{id}/alerts?viewer_id=` | | Alert[] | Only the alerts this viewer may see (see RULES.md). `viewer_id=teacher` shows teacher-level alerts. |
| `GET /demo/time` | | DemoTime | Current clock value and whether it is overridden. |
| `POST /demo/time` | `now` | DemoTime | Overrides the clock and runs any due checkpoint evaluations. |
| `POST /demo/seed` | | `{"ok": true}` | Wipe and load the demo story. |
| `POST /demo/reset` | | `{"ok": true}` | Wipe everything. |

Entries and reviews are append-only: there are no update or delete endpoints for them.
