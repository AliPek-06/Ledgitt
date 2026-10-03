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
