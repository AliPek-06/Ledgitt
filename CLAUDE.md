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
  - The Contribution model is truncated after actual_points.