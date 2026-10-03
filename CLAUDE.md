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
### 2026-10-03 - Phase F1: frontend scaffold, API client, mocks
- Vite + React 19 + TypeScript + Tailwind v4 (@tailwindcss/vite) + React Router 7 in
  frontend/. Written by hand: Node was not installed on the dev machine, so
  `npm install` and a typecheck have NOT been run yet.
- src/api/types.ts: every model in API.md, plus request-body types and Clock.
- src/api/client.ts: one function per endpoint, base http://localhost:8000/api.
  `VITE_USE_MOCKS=true` (or `npm run dev:mocks`, which loads .env.mocks) routes every
  call to src/mocks/mockApi.ts.
- src/mocks/fixtures.ts: assignment 1 (join code GRP7K4, checkpoints 0.33/0.66),
  team 1 "Group 7" (Maya 1, Jordan 2, Priya 3, Sam 4), locked 6-item charter,
  11 entries (5 confirmed, 4 pending, 2 disputed), one flagged paste (Jordan), one
  internal paste (Priya), one private alert for Sam at 0.33. Mock now = 2026-09-24.
- src/mocks/mockApi.ts: in-memory store; re-derives entry status and contributions
  per RULES.md, hides records after "now", supports a demo clock override.
  Checkpoints are not re-evaluated in mocks.
- Routes (placeholders): /teacher/new, /teacher/:assignmentId, /join/:code,
  /team/:teamId/charter, /team/:teamId, plus a dev index at /.
- CurrentUserContext (member id or "teacher", saved in localStorage) and a header
  switcher listing the members of the team in the URL.
- Open:
  - API.md has no endpoints. client.ts has a DRAFT endpoint list in its header
    comment; it needs agreeing and copying into API.md before the backend builds them.
  - Contribution type guesses `progress_ratio: number | null` and
    `status: "not_started_yet" | "on_track" | "behind"` (API.md is truncated).
  - AlertLevel keeps "teacher" to match API.md. RULES.md does not define what the
    teacher sees; the mock shows the teacher team-level alerts only.
  - Labelling a paste (POST /pastes/{id}/label) mutates a PasteEvent. PasteEvent is
    not marked append-only, but confirm that is intended.
### 2026-10-03 - API contract completed; F1 client and mocks aligned to it
- docs/API.md now holds the full contract from section 3 of the build guide:
  `/api` prefix, the endpoint table (23 endpoints incl. /demo/*), and the rest of
  the Contribution model (`progress_ratio: float | null`, `status`).
- Response shapes the guide described only in prose were defined in API.md:
  AssignmentCreated (Assignment + join_url), JoinInfo, TeamDetail (Team + members +
  charter_items), Overview / TeamOverview (health, open_disputes, teacher_alerts),
  DemoTime. POST /entries/{id}/reviews returns the updated Entry. /demo/seed and
  /demo/reset return {"ok": true}. Errors are FastAPI {"detail": ...}.
- frontend/src/api/types.ts, client.ts and src/mocks/mockApi.ts rewritten to match.
  ApiError moved to src/api/errors.ts. Mocks enforce the 400/403 rules (self-review,
  double review, dispute note, charter validation and lock, paste label owner).
- Supersedes the F1 open items "API.md has no endpoints" and "Contribution guessed".
- Open:
  - RULES.md vs API.md still disagree on checkpoint defaults (0.33/0.66 vs
    0.25/0.5/0.75) and the "teacher" alert level. API.md keeps "teacher", and the
    overview/alerts endpoints depend on it. Mocks use 0.33/0.66.
  - `npm run typecheck` and `npm run build` pass (Node 24). The F1 "Done when"
    checks in the browser still need doing by hand.
### 2026-10-03 - Phase F2: teacher screens
- /teacher/new (src/pages/TeacherNew.tsx): title + start/due date form; dates are sent
  as local midnight in ISO 8601. Client-side check that due > start, and backend
  errors are shown. On success, a large join link with a Copy button, the join code,
  and a link to the dashboard.
- /teacher/:assignmentId (src/pages/TeacherAssignment.tsx): GET overview, polled every
  3s. One card per team: name, health dot + label, members, open disputes, "charter
  not locked" note, teacher-level alerts with reasons (the only red UI).
  Health labels: green "On track", amber "Worth a check-in", red "Needs your support".
- Clicking a team card sets the current user to "teacher" and opens /team/:id.
  Decision: "read-only workspace" = viewing as teacher (no member id). F4 must hide
  log/review/edit controls when the current user is "teacher".
- Shared: src/hooks/usePolling.ts (3s, no overlapping requests, keeps last good data
  on error), src/lib/format.ts (dates, plurals). Design tokens in src/index.css:
  deep-teal accent (bg-accent, text-accent...), stone neutrals, 18px base font for
  the projector. Layout now uses these; the "mock data" badge is neutral, not amber.
- Mocks: added Group 3 (Alex, Ben, Chloe; open teacher alert for Ben -> red) and
  Group 2 (Noah, Lena, Omar; unlocked charter -> green) so all three colours show.
  Ben's teacher alert is set directly; mocks do not run the escalation ladder.
- Verified: typecheck + build pass; mock overview gives Group 7 amber, Group 3 red,
  Group 2 green. Not yet checked in a browser.
- Open: the RULES.md vs API.md "teacher" alert-level disagreement still stands; the
  red state on this dashboard only exists if the teacher level is kept.
### 2026-10-03 - Phase F3: join page and charter builder
- /join/:code (src/pages/Join.tsx): GET /join/{code}; shows assignment title, dates and
  teams (radio cards, "Charter agreed" / "Still planning"), or "Start a new team" with
  a name field. Join = optional POST team, then POST member; sets the current user to
  the new member and goes to the charter if unlocked, else the workspace. Unknown
  code -> friendly 404 message.
- /team/:teamId/charter (src/pages/TeamCharter.tsx): loads GET team + GET assignment
  once (no polling, so it never clobbers unsaved edits). Rows of member / responsibility
  / planned points / time window. Client-side checks mirror the B3 rules; Save is
  disabled while invalid or unchanged; "Unsaved changes" indicator.
  Lock: disabled while there are unsaved changes, asks for confirmation in a modal,
  then the page turns read-only with a link to the workspace. If a save fails, the
  page re-fetches in case a teammate locked it meanwhile.
- Decision: the charter is also read-only for anyone who isn't a member of that team
  (including "teacher"), with a hint to switch user.
- New components: RangeSlider (two handles, pointer + keyboard, 1% steps, checkpoint
  ticks), CharterTimeline (one lane per member with point totals, bars stack when a
  member's items overlap, dashed checkpoint lines labelled with % and date), Modal
  (reusable; Escape/backdrop closes). lib/format.ts: formatPct, dateAtPct.
- Checkpoint markers come from assignment.checkpoints, not a hard-coded 25/50/75, so
  they follow whatever RULES.md/API.md settle on (mocks: 33/66).
- Mocks: Sam's charter windows moved to 0.0-0.35 and 0.6-1.0 (work at the start and
  end, as in the B7 seed); Sam's alert reason updated to ~3.8 expected points.
- Verified: typecheck + build pass; mock join flow and charter save / validation /
  lock / save-after-lock checked in Node. Not yet checked in a browser.
