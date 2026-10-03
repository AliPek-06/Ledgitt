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
