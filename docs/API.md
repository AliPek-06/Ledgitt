# Ledger API contract

Source of truth for data models shared by backend and frontend.
Do not change field names without updating this file.

Conventions:
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
| `p…` | | **TODO: contract was truncated here.** Likely `progress_ratio` and a status (`"not_started_yet"` / behind / on track); confirm. |

## Endpoints

**TODO:** no endpoints were included in the contract yet.
