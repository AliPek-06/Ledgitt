# Ledgitt - hackathon project
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
### 2026-10-03 - Phase F7: demo control panel
- src/components/DemoPanel.tsx, mounted in Layout so it is on every page. Fixed
  bottom-right, small neutral styling. D toggles it fully hidden/shown (ignored while
  typing in inputs/textareas/selects/the editor); the header collapses it to one
  line ("Demo · 41%"). Visibility is remembered in localStorage.
  - Time: range slider over the assignment start..due with checkpoint ticks; the
    readout (date + %) follows the drag, POST /demo/time on release (pointer or
    keyboard). "Jump to N% checkpoint" sets the time 1 hour past the next checkpoint.
    Shows "Demo time" vs "Real time" (overridden flag).
  - Which assignment: the one in the URL (/teacher/:id, or the team's on /team/:id),
    else assignment 1 (the seeded demo).
  - View as: Maya 1, Jordan 2, Priya 3, Sam 4, Teacher (ids match both the mock
    fixtures and the backend seed).
  - Seed demo; Reset asks "Wipe everything?" first.
- Refresh: src/lib/refresh.ts refreshAll() fires a window event that every
  usePolling hook listens for, so a time change updates all polled screens at once
  (measured ~150 ms vs the 3 s poll). After seed/reset, Layout bumps a key that
  remounts the header + page, so load-once screens (charter, document) reload too;
  the panel sits outside that key and keeps its state.
- Verified in headless Edge against mocks: 37/37 checks (show/hide/collapse, D
  ignored while typing, user buttons, slider -> hero/alerts/ledger time-travel,
  jumps, seed, reset + confirm, panel on every page, hidden state persists), no
  console errors.
- Open: mocks don't run checkpoint evaluation, so moving time only shows/hides the
  fixture alerts; the real escalation story needs the backend (I1/I2). The mock seed
  reloads the F1 fixtures, not the backend's "Engineering Design Report" story.
### 2026-10-03 - Phase I1: integration (frontend against the real backend)
- Setup: frontend/.env.local has VITE_USE_MOCKS=false (gitignored by *.local).
`npm install` was run in frontend/; no new dependencies.
- Checked every screen against the seeded backend: join, teacher new/dashboard,
charter, workspace ledger/document/progress, alerts, demo panel. Also called every
client.ts function directly against the backend, including the 400/403/404 cases.
API.md endpoints still match the backend's 24 routes exactly.
- Mismatches fixed (frontend changed to match API.md unless noted):
  1. Join page crashed: it expected {assignment, teams}. The type is now
  AssignmentDetail (assignment fields + join_url + teams), used by getJoinInfo,
  getAssignment and createAssignment. JoinInfo and AssignmentCreated were removed.
  2. Teacher dashboard crashed: it expected {team, members, open_disputes,
  teacher_alerts}. TeamOverview now matches the API.md TeamHealth row, and Overview
  has t. TeamCard shows "N members", "N open disputes", an "N team alert(s) open"
  notice and "N unlabelled paste(s)".
  3. Teacher alert level removed from the frontend (AlertLevel, LEVEL_RANK,
  AlertsBanner, the Viewer type). listAlerts(teamId, viewerId: number).
  TeamWorkspace only polls alerts when the current user is in the team; previously
  the teacher got 422 and outsiders got 400 every 3 s. The teacher persona stays.
  4. seedDemo() return type is now Overview.
  5. Document.updated_by is number | null in types.ts AND in API.md, which used to
  say int.
  6. getAssignment() returns AssignmentDetail.
- Mocks (src/mocks) updated to the same shapes and rules: listAlerts rejects
non-members, the fixture's Ben alert is now level "team", seedDemo returns the
overview.
- Also fixed:
  - A: the seed paste text was cut mid-word. backend/app/services/seed.py now has a
  900-char paragraph ending in a full stop (asserted at import).
  - B: UserSwitcher showed "Member #4" off team pages. It now caches member names in
  localStorage "ledger.memberNames" whenever a team loads.
- Verified live:
  - The overview goes green/green -> amber/green -> amber/red at t = 0.35/0.50/0.70.
  - Teacher workspace sends no alert requests.
  - Alex sees Ben's team alert.
  - No console errors.
  - 164 backend tests pass; frontend tsc is clean.
- Alert reason fixed afterwards (backend):
  - _alert_reason(row) in app/services/checkpoints.py is now just "{actual} of
  {expected:.1f} expected points confirmed". The checkpoint lives in
  Alert.checkpoint, and the frontend banner says "At the N% checkpoint" itself.
  - Test in test_recovery_resolves_alerts_and_resets_streak.
  - API.md Alert.reason/created_at notes added.
  - Mock fixture reasons use the same format.
### 2026-10-03 - Phase I2: demo script walkthrough
- Walked the 9-step script in Chrome against the seeded backend. Steps 1-8 behave as
scripted after these fixes (no features added):
  - Document save loop (frontend/src/components/document/DocumentEditor.tsx):
  TipTap's setEditable(editable, emitUpdate = true) emitted an update on every
  team poll, because `me` is a new object each poll. That re-saved the document
  every 3 s, left the status stuck on "Editing…", and blocked or overwrote
  teammates' changes. Now it depends on a boolean canEdit and calls
  setEditable(canEdit, false). Verified: only GETs while idle, status "Saved".
  - formatPct (frontend/src/lib/format.ts) now rounds down (+1e-9 for float error).
  Rounding to nearest showed "33%" from 32.5% on, so sliding to "33%" could give
  no nudge. Applies everywhere percentages show.
  - AlertsBanner shows only each member's latest open alert. Ben at 66% saw both the
  team alert and his still-open 33% private nudge, with different numbers.
- Checked and fine: D toggles the demo panel (the hidden state persists in
  localStorage "ledger.demoPanel"). The jump button sets checkpoint + 1 h.
- Decided by the user and done:
  - Teachers are never notified (script step 9).
    - team_health(disputed_entries) is amber if any dispute, otherwise green. There
    is no red any more.
    - open_team_alerts removed from TeamHealthOut, the overview, API.md and the
    frontend types and mocks.
    - The teacher card shows no alert text.
    - RULES.md "Team health" and API.md Overview updated.
    - Tests: test_team_health, the story (Group 3 stays green at 70%),
    test_overview_never_reflects_alerts, test_overview_hides_future_disputes.
  - Teammates' status is private:
    - frontend/src/lib/progress.ts displayStatus() shows another member's
    on_track/behind as "not_shared" ("Private to them", neutral grey bar) unless an
    open team-level alert about them is visible.
    - Your own row and "not started yet" always show.
    - On-track teammates are masked too, otherwise the neutral pill would single
    out who is behind.
    - The teacher and outsiders see all rows as private.
- Verified live after the changes:
  - Maya at 33%: all teammates "Private to them".
  - Alex at 66%: Ben "Some catching up to do", Chloe private.
  - Teacher at 66%: Group 7 amber, Group 3 green, no alerts.
  - 164 backend tests pass; frontend tsc is clean.
### 2026-10-03 - Phase I3: polish (no new features)
- Loading/empty states:
  - ProgressTab no longer hangs on "Loading progress…" when getAssignment fails; it
  shows "We couldn't load progress just now. Please try again."
  - ProgressTab "Planned vs confirmed": with no members it shows "No members yet…"
  instead of an empty chart.
  - TeamWorkspace header shows "No members yet" instead of a blank line.
  - Join loading text is "Loading the assignment…".
  - TeacherAssignment: a 404 shows "We couldn't find this assignment…"; other errors
  show a generic retry message, never the raw error text.
- Projector (checked at 1280 CSS px wide, top 720 px as the fold):
  - Layout <main> has pb-80 so content can scroll clear of the fixed demo panel. It
  had covered the "Label it" button in script step 4.
  - DemoPanel is w-[22rem] (was w-80), so "View as" mostly fits on one row.
  - Low-contrast text-stone-400 -> stone-500 for review timestamps (EntryCard) and
  not-yet-reached check-in ladder steps (EscalationLadder).
  - The "Private to them" pill no longer shows a double dot (icon removed).
- Wording:
  - EscalationLadder: "Flagged at 33%" -> "Behind at the 33% check-in"; "was flagged
  at …" -> "was a bit behind at the … check-in(s), and is now keeping up".
  - Fallback errors use one pattern: "We couldn't <action> just now. Please try
  again." (log work, review, label, save/lock charter, join, create assignment).
  - TeacherNew: a blank (whitespace) title gives "Give the assignment a title."
  instead of a backend 422.
  - client.ts: a 422 whose detail is not a string shows "Some details aren't quite
  right. Please check the form and try again." instead of "Unprocessable Content".
- Console: walked the full script (teacher, charter, ledger, label paste as Jordan,
33% Sam/Maya, 55% live confirm + dispute modal, 66% Sam, Group 3 Alex/Ben, teacher)
plus home, join, new assignment, 404 page. No errors or warnings, only React's
DevTools info line.
- Note for automation: some scripted clicks on Confirm didn't register, but a JS
.click() and the handler (plain onClick) work. This was not reproduced as an app bug.
### 2026-10-03 - Rename: app is "Ledgitt"
- Product name changed from "Ledger" to "Ledgitt":
  - header brand (Layout.tsx), <title> (index.html), Home placeholder title
  - FastAPI title "Ledgitt API"
  - headings in README, CLAUDE.md, docs/API.md and docs/RULES.md
  - seed.py docstring
  - frontend package name "ledgitt-frontend" (package.json and package-lock.json)
- "Ledger" as the feature (the Ledger tab, the API.md "Ledger" section, append-only
ledger wording) is unchanged.
- Internal identifiers were kept so nothing breaks: backend/ledger.db, and the
localStorage keys ledger.currentUser / ledger.demoPanel / ledger.memberNames.
### 2026-10-03 - Guided presentation mode (/demo), frontend only
- Route /demo (App.tsx, lazy-loaded, outside Layout, so there is no header or
DemoPanel and the live app never loads its code or CSS). There are no network
calls: all data comes from frontend/src/demo/script.ts.
- Files:
  - src/demo/script.ts: fixture (Group 7, charter, 5-paragraph printing-press
  document, paste 890 chars, entries, alerts, contribution at t=0.665, teacher
  overview with Groups 7/3/5) plus the 15 steps (section, caption, viewer, duration).
  - src/demo/scenes.tsx: one scene per section, each a pure function of (step,
  elapsed ms). elapsed = Infinity is the finished state.
  - src/demo/DemoPresentation.tsx: keys, step clock, top section bar, "Viewing as"
  badge, caption bar, step counter. The 1280x720 stage is scaled to the window.
  - src/demo/demo.css: animations scoped under .demo-stage.
- How animation works:
  - Thresholds on elapsed toggle state, and CSS transitions/keyframes animate it.
  Every step's duration is < 1.5 s.
  - "Finish now" sets settled = true, and the .demo-settled class turns off all
  transitions and animations.
  - Going back renders the previous step settled.
  - Scenes are keyed by section, so within a section only new things animate.
  - Key handlers read posRef, so fast double presses never act on a stale step, and
  "still animating" is judged with performance.now() at keypress time.
  - The clock ticks with setInterval plus a final timeout, not requestAnimationFrame,
  which pauses in hidden tabs.
- Live components split into presentational views + containers (live behaviour
unchanged and verified):
  - EntryCardView (EntryCard keeps reviewing + DisputeModal).
  - LabelPasteForm (LabelPasteModal keeps state + labelPaste).
  - LogWorkFormView + LogWorkValues (LogWorkForm keeps state + createEntry).
  `compact` prop, default false, used only by the demo: sizes in one row, no hints,
  2-row textarea, no footer note.
  - DocumentFrame (the box + header bar, from DocumentEditor).
  - TeacherOverview (TeacherAssignment fetches). `interactive={false}` renders plain
  cards without links or setCurrentUser.
  - The demo reuses CharterTimeline, FlaggedPastesPanel, AlertsBanner,
  ProgressTimeline, ContributionChart, EscalationLadder and displayStatus as-is.
- Per-section zoom (SCENE_ZOOM) was measured against the 540px content area at each
section's tallest step.
- The Progress step composes the dashboard's parts (chart + timeline + ladder),
because the full ProgressTab is ~1400px tall. A ProgressView split was tried and
reverted, so ProgressTab is unchanged.
- Deviations from the brief:
  - The title card says "Ledgitt" (the app was renamed), not "Ledger".
  - Step 12 reuses the real AlertsBanner, so it reads "Sam has some catching up to
  do. At the 66% checkpoint: …" rather than the scripted "Sam is behind his plan for
  this stage".
- Verified:
  - All 15 finished states (DOM).
  - Forward vs back screens identical for every step.
  - Enter/Space mid-animation finishes the step, then advances.
  - R, H and Esc work.
  - No console errors and no :8000 requests on /demo.
  - Live ledger confirm/log, label pop-up and teacher links work against the
  backend.
  - Production build ok (Demo chunk 20 kB JS + 1 kB CSS).
- Note: the automation browser tab was "hidden", which throttles timers and painting.
Mid-animation screenshots lag there; a visible presenter tab animates normally.
