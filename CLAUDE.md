# Ledger - hackathon project
Group-work contribution tracker. Teams agree a charter (who does what, when), log
contributions in an append-only ledger that teammates confirm or dispute, and get
early warnings at time checkpoints when someone falls behind their own plan.
## Source of truth
- API contract: docs/API.md. Never change endpoints or field names without updating it.
- Business rules: docs/RULES.md (entry status, early warning, paste detection).
## Stack
- backend/: Python 3.11, FastAPI, SQLModel + SQLite, pytest.
Run: cd backend && uvicorn app.main:app --reload --port 8000
- frontend/: React + TypeScript (Vite), Tailwind, React Router, TipTap, Recharts.
Run: cd frontend && npm run dev (port 5173)
## Rules for Claude
- Only build the phase you are asked to build. Ask before going further.
- Hackathon scope: a working demo beats perfect architecture. Keep it simple.
- No real auth. Identity = a member id chosen in a user switcher.
- Ledger entries and reviews are append-only: no update or delete endpoints.
- "Now" always comes from backend/app/services/clock.py. Never call datetime.now()
directly in business logic. List endpoints hide records created after "now".
- Polling, not websockets.
- Do not add dependencies outside the stack without asking.
- Every business rule in docs/RULES.md gets a pytest test.
- Do not commit to github, leave that to user
- After every implementation, add a dated entry to the Implementation log below:
what was built or changed, key files, decisions made, and anything left open.
## Implementation log
### 2026-10-03 - Phase 0: scaffolding and docs
- Created backend/, frontend/, docs/ (empty, with .gitkeep). No app code yet.
- Root README.md (run instructions) and .gitignore (Python, Node, SQLite, editors,
.claude/settings.local.json).
- docs/RULES.md written from the user's rules. Decisions:
  - No teacher role. Alert levels are only "private" (streak 1) and "team" (streak 2+).
  - Default checkpoints are 0.33, 0.66.
- docs/API.md written from the user's models.
- Open:
  - API.md still has the old checkpoint default [0.25, 0.5, 0.75] and a "teacher"
  alert level. The user asked to leave API.md unchanged for now, so RULES.md and
  API.md disagree here.
  - API.md has no endpoints yet.
  - The Contribution model is truncated after actual_points.### 2026-10-03 - Phase B1: backend skeleton
- backend/app/main.py: FastAPI app, CORS for http://localhost:5173, GET /api/health
-> {"ok": true}. Tables are created on startup (lifespan).
- backend/app/db.py: SQLite engine (backend/ledger.db), get_session dependency.
- backend/app/models.py: tables Assignment, Team, Member, CharterItem, Entry, Review,
Document, PasteEvent, Alert, plus warning-engine state MemberStreak
(team_id, member_id, streak) and EvaluatedCheckpoint (team_id, checkpoint).
- Model decisions:
  - Entry.evidence and Assignment.checkpoints are JSON columns.
  - Assignment.checkpoints defaults to [0.33, 0.66].
  - Entry.status and Entry.reviews are not stored. Status is derived from Review rows.
  - Contribution is computed, so it has no table.
  - Document's primary key is team_id.
  - Enum-like fields are plain strings, with the allowed values in comments.
  - Alert.level is "private" | "team".
  - created_at has no default. Callers must set it from app/services/clock.py.
- app/services/ exists but clock.py has not been written yet. It must exist before
any endpoint creates records.
- Tests: backend/tests/conftest.py provides an in-memory `session` fixture
(StaticPool) and a `client` fixture (TestClient with get_session overridden; it
skips lifespan so tests never touch ledger.db). test_health.py checks the health
endpoint and that all tables exist.
- requirements.txt: fastapi, uvicorn[standard], sqlmodel, pytest, httpx.
- Dev machine only has Python 3.13 (venv at backend/.venv). Keep code 3.11-compatible.
- No other endpoints yet.
### 2026-10-03 - Phase B2: clock, assignments, teams, demo time
- app/services/clock.py: now(), set_override(dt), clear_override(), is_overridden(),
to_utc(dt). All datetimes are timezone-aware UTC because sqlmodel>=0.0.47 rejects
naive datetimes. Naive input is treated as UTC. The API returns ISO strings with "Z".
- app/schemas.py: Pydantic request/response models (AssignmentCreate validates
due_date > start_date and that checkpoints are in (0, 1); stores them sorted).
- app/routers/assignments.py: POST /api/assignments, GET /api/assignments/{id},
GET /api/join/{code} (case-insensitive), POST /api/assignments/{id}/teams.
Join codes are 6 characters from A-Z and 2-9, leaving out 0/O/1/I.
join_url = http://localhost:5173/join/{code}.
- app/routers/teams.py: POST /api/teams/{id}/members, GET /api/teams/{id} (with members).
- app/routers/demo.py: GET/POST /api/demo/time; body {now: datetime|null}, null clears.
Marked "B6" where checkpoint evaluation must be hooked in.
- docs/API.md now has an Endpoints section documenting all of the above.
- tests/conftest.py has an autouse fixture that clears the clock override.
26 tests across test_clock, test_assignments, test_teams, test_demo_time.
- Not done or open:
  - No duplicate-name check on members.
  - Adding members is not blocked when the charter is locked.
  - API.md model section still has the stale "teacher" level and checkpoint default.
### 2026-10-03 - Phase B3: charter
- app/routers/charter.py:
  - PUT /api/teams/{id}/charter takes {items: [...]} and replaces the whole charter
  (old rows deleted, so ids change). It returns TeamDetail.
  - POST /api/teams/{id}/charter/lock returns TeamDetail.
- Validation returns 400, checked in the router, not Pydantic, so it isn't 422.
The detail message names the item ("Charter item N: ..."). Rules:
  - 0 <= start_pct < end_pct <= 1
  - planned_points > 0
  - responsibility not blank
  - member_id belongs to the team
  - PUT is rejected when locked
  - If any item is invalid, nothing is saved.
- Lock: 400 if the charter is empty or already locked. There is no unlock.
- app/routers/teams.py: team_detail() helper. GET /api/teams/{id} now includes
charter_items.
- app/schemas.py: CharterItemIn, CharterIn, CharterItemOut;
TeamDetailOut.charter_items.
- tests/test_charter.py covers every rule; 47 tests total.
- docs/API.md has a Charter section.
### 2026-10-03 - Phase B4: ledger
- app/services/status.py: pure entry_status(verdicts, team_size) and
confirms_needed(team_size) = ceil((team_size - 1) / 2). A 1-person team needs 0
confirms, so its entries are confirmed straight away.
- app/routers/ledger.py (append-only, GET/POST only):
  - POST /api/teams/{id}/entries
  - GET /api/teams/{id}/entries (newest first)
  - POST /api/entries/{id}/reviews (returns the updated entry)
- created_at always comes from clock.now().
- Time filtering:
  - Entries with created_at > now are hidden.
  - Reviews with created_at > now are hidden too, and status is computed only from
  visible reviews.
  - Team size = current member count (members have no created_at).
- Entry rules (all 400):
  - member in team, description not blank, size S/M/L
  - evidence kind valid and ref not blank
  - charter_item_id in the team, and only allowed once the charter is locked, because
  PUT replaces item ids
- Review rules (all 400):
  - reviewer in team, not the author
  - verdict is confirm/dispute
  - a dispute needs a note
  - one review per reviewer per entry, checked against all reviews including hidden
  ones
- Reviewing a hidden or unknown entry returns 404.
- Tests:
  - tests/test_status.py: unit tests for the pure function.
  - tests/test_ledger.py: endpoints, rejections, time travel, and a check that no
  PUT/PATCH/DELETE routes exist for entries/reviews.
  - 81 tests total.
- docs/API.md has a Ledger section.
- Points per size (S=1, M=2, L=4) are not implemented yet. That belongs to the contribution
calculation (later phase).
### 2026-10-03 - Phase B5: document and pastes
- app/routers/documents.py:
  - GET /api/teams/{id}/document creates an empty Document on the first GET
  (updated_at = clock.now(), updated_by = null).
  - PUT /api/teams/{id}/document takes {member_id, content_html, content_text} and
  overwrites. Sets updated_at/updated_by. The member must be in the team (400).
  - POST /api/teams/{id}/pastes stores the event. The server cuts preview to 120
  characters and sets created_at = clock.now().
  - flagged = is_flagged(is_internal, label) = not is_internal and label is None.
  - The backend trusts the frontend's is_internal and does not enforce the 200/300
  thresholds.
  - A label may be given on create. 400 for bad kind, bad label, negative char_count,
  or a member not in the team.
  - GET /api/teams/{id}/pastes returns non-internal events with created_at <= now,
  newest first.
  - PATCH /api/pastes/{id}/label takes {member_id, label, label_note}:
    - 403 unless member_id is the paster.
    - label must be one of my_notes/quote/moved/other (null not allowed).
    - Sets flagged = false.
    - 404 if the paste is hidden by demo time.
- Paste events are not append-only: a label can be changed again.
- tests/test_documents.py; 105 tests total. docs/API.md has a "Document and pastes"
section.
### 2026-10-03 - Phase B6: early warnings (contribution, checkpoints, alerts)
- app/services/warnings.py (pure, no DB/clock):
  - SIZE_POINTS = S1/M2/L4
  - elapsed_fraction, expected_points
  - contribution_rows(members, charter_items, entries, t), where entries are
  EntryPoints(member_id, size, status)
  - is_behind(row, team_median), team_median(rows), next_level(streak):
  1 = private, 2+ = team
  - Contribution dataclass: member_id, name, expected_points, actual_points,
  progress_ratio (None if expected < 1), status
  (not_started_yet | behind | on_track)
- app/services/checkpoints.py (DB):
  - team_contribution(session, team, t, cutoff) builds rows from records with
  created_at <= cutoff. Status is computed from reviews up to the cutoff.
  - evaluate_due_checkpoints(session, team_id):
    - Only runs for locked charters. Takes checkpoints in order where t_now >= c and
    no EvaluatedCheckpoint row exists.
    - Each checkpoint is judged at t = c with cutoff = checkpoint datetime.
    - Behind: streak += 1 and an Alert is created (created_at = checkpoint datetime).
    - Not behind: streak = 0 and the member's open alerts are resolved.
    - Commits per checkpoint.
  - evaluate_all_teams(session) is called by POST /api/demo/time.
  - A charter locked after checkpoints passed gets them evaluated retroactively on
  the next call.
- app/routers/warnings.py: both endpoints evaluate first.
  - GET /api/teams/{id}/contribution -> {t, team_median, members}
  - GET /api/teams/{id}/alerts?viewer_id= -> team alerts + the viewer's own private
  alerts, created_at <= now, newest first, resolved ones included. viewer_id is
  required; 400 if not in the team.
- No teacher level anywhere (the user confirmed teacher was dropped).
- Pylance fix: use sqlmodel col() for .desc()/.in_() and filter Optional ids from
select(X.id).
- Tests:
  - tests/test_warnings.py: table-driven pure tests.
  - tests/test_checkpoints.py: scenarios through demo time (uneven charter, zero-work,
  stalls, escalation 1/2/3, recovery, streak reset, evaluated once, multi-checkpoint
  jump, unlocked charter, visibility, contribution).
  - 155 tests total.
- Known limitation: moving demo time backwards does not undo evaluations. Streaks,
EvaluatedCheckpoint and resolved flags stay; alerts still hide by created_at.
- No overview endpoint exists yet. When it is built, it must call
evaluate_due_checkpoints first.
- API.md:
  - Contribution model completed; "Contribution and alerts" section added.
  - Model section fixed afterwards: Alert.level is "private" | "team" and the
  checkpoint default is [0.33, 0.66]. API.md and RULES.md now agree.
### 2026-10-03 - Phase B7: overview, demo reset and seed
- Requirements were adapted to the current rules: checkpoints 0.33/0.66, no teacher.
Health: red = open team alert, amber = disputed entry, else green. Private alerts
never affect health.
- app/services/warnings.py: team_health(open_team_alerts, disputed_entries), pure.
- app/services/checkpoints.py: extracted entry_points(session, team_id, team_size,
cutoff), used by team_contribution and the overview.
- app/routers/overview.py: GET /api/assignments/{id}/overview ->
{assignment (summary + join_url), t, teams: [{id, name, charter_locked,
member_count, health, open_team_alerts, disputed_entries, flagged_pastes}]}.
It evaluates due checkpoints for every team first. Counts use created_at <= now.
- app/schemas.py: AssignmentSummaryOut (AssignmentOut now extends it with teams),
TeamHealthOut, OverviewOut.
- app/services/seed.py: reset_db(session) drops and recreates all tables via
session.get_bind() and clears the clock. seed(session) resets, then writes rows
directly with fixed timestamps and sets the clock to t=0.20.
  - Assignment 1 "Engineering Design Report", 2026-09-07 -> 2026-10-19, join code
  ENGDES.
  - Group 7 (id 1): Maya 1, Jordan 2, Priya 3, Sam 4.
    - Sam's first entry is at day 14.5, just after 33% (day 13.86).
    - Priya's day-8 entry is left pending (1 of 2 confirms) for a live confirm.
    - Jordan's 900-char unlabelled paste at t=0.15; the document holds that text.
    - Jordan's "Wrote section 3 analysis" (day 17): Maya confirms, Priya disputes at
    t=0.45.
  - Group 3 (id 2): Alex 5, Ben 6, Chloe 7. Ben has no entries and no reviews.
- Story at each step:
  - t=0.20: both groups green.
  - t=0.35: Sam and Ben private; both green.
  - t=0.50: Group 7 amber (dispute).
  - t=0.70: Sam resolved, Ben team; Group 7 amber, Group 3 red.
- app/routers/demo.py:
  - POST /api/demo/reset -> {"ok": true}
  - POST /api/demo/seed -> overview of assignment 1
- Tests: tests/test_seed.py (story, seeding twice identical, reset, overview ignores
private/future) and test_team_health; 164 tests total.
- Docs: API.md has Overview and demo reset/seed. RULES.md has a Team health section.
README shows how to seed.
### 2026-10-03 - Phase F6: progress dashboard
- Adapted to the current rules (user dropped the teacher level; RULES.md/API.md):
  the ladder has two steps (private nudge -> team heads-up), and checkpoint markers
  come from assignment.checkpoints (0.33/0.66), not a fixed 25/50/75.
- Aligned GET /teams/{id}/contribution with API.md: frontend type ContributionReport
  {t, team_median, members}; progress_ratio null when expected < 1. Client and mock
  updated. Other client/API.md mismatches are still left for I1.
- Added recharts 3.10 (in the stack). Progress tab is lazy-loaded (own chunk).
- src/components/progress/:
  - ProgressTab: hero "% of project time passed · day X of Y", next check-in,
    timeline, chart + table, ladder. Polls contribution and alerts every 3s.
    Alerts are only fetched for team members (API.md: viewer_id must be in the team);
    teacher/non-members see the chart and a "members only" note.
  - ContributionChart (Recharts): per member, planned-by-now (neutral #d6d3d1) vs
    confirmed (status palette: on track #0ca30c, behind #fab219, not started
    #78716c). Per dataviz skill: <=24px bars, 4px rounded tops, 2px gap, hairline
    solid grid, legend, value labels only on confirmed bars, hover tooltip, and a
    table view with icon + label per status. minPointSize=3 so a 0 still shows as a
    stub in its status colour.
  - ProgressTimeline: elapsed fill, checkpoint ticks + dates, "Now" tag, and alert
    pills under the checkpoint where each alert happened (private teal, team amber,
    resolved grey with ✓).
  - EscalationLadder: one card per member with visible alerts; reached step = highest
    level among open alerts; all resolved -> "✓ Back on track".
- lib/progress.ts: status meta, ladder steps, formatPoints.
- Verified in headless Edge against mocks (incl. an injected later-project scenario
  with a resolved and a team-level alert): visibility per viewer (Sam/Maya/Jordan/
  Teacher), chart + table values, live update via polling after confirmations,
  ladder states, tooltip, no console errors. Screenshots checked.
- Open: no dark mode anywhere in the app (light only). Mock alerts are fixtures; the
  mock does not run checkpoint evaluation.
