// In-memory stand-in for the backend, used when VITE_USE_MOCKS=true.
// Each function mirrors one in src/api/client.ts and follows docs/API.md,
// including its 400/403/404 errors. Writes are lost on page reload.
//
// Not simulated: checkpoint evaluation. Alerts come from the fixtures only.

import { ApiError } from "../api/errors";
import type {
  Alert,
  Assignment,
  AssignmentDetail,
  CharterItemInput,
  Contribution,
  ContributionReport,
  CreateAssignmentBody,
  CreateEntryBody,
  CreatePasteBody,
  CreateReviewBody,
  DemoTime,
  Document,
  Entry,
  EntrySize,
  LabelPasteBody,
  Member,
  Ok,
  Overview,
  PasteEvent,
  Review,
  SaveDocumentBody,
  Team,
  TeamDetail,
  TeamHealth,
} from "../api/types";
import * as fx from "./fixtures";

function freshDb() {
  return structuredClone({
    assignments: fx.assignments,
    teams: fx.teams,
    members: fx.members,
    charterItems: fx.charterItems,
    entries: fx.entries,
    documents: fx.documents,
    pastes: fx.pasteEvents,
    alerts: fx.alerts,
  });
}

let db = freshDb();
let nowOverride: string | null = null;
const now = () => nowOverride ?? fx.MOCK_NOW;

const SIZE_POINTS: Record<EntrySize, number> = { S: 1, M: 2, L: 4 };

// ---- Helpers ----

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

function badRequest(message: string): never {
  throw new ApiError(400, message);
}

function find<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new ApiError(404, `${what} not found`);
  return row;
}

function clone<T>(value: T): Promise<T> {
  return Promise.resolve(structuredClone(value));
}

// List endpoints hide records created after "now" (RULES.md, Time).
function visible<T extends { created_at: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.created_at <= now());
}

function newestFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const findTeam = (id: number) => find(db.teams.find((t) => t.id === id), "Team");
const findAssignment = (id: number) => find(db.assignments.find((a) => a.id === id), "Assignment");
const teamMembers = (teamId: number) => db.members.filter((m) => m.team_id === teamId);
const joinUrl = (code: string) => `http://localhost:5173/join/${code}`;

function assignmentDetail(a: Assignment): AssignmentDetail {
  return { ...a, join_url: joinUrl(a.join_code), teams: db.teams.filter((t) => t.assignment_id === a.id) };
}

function deriveStatus(entry: Entry): Entry["status"] {
  const reviews = visible(entry.reviews);
  if (reviews.some((r) => r.verdict === "dispute")) return "disputed";
  const needed = Math.ceil((teamMembers(entry.team_id).length - 1) / 2);
  const confirms = reviews.filter((r) => r.verdict === "confirm").length;
  return confirms >= needed ? "confirmed" : "pending";
}

function presentEntry(entry: Entry): Entry {
  return { ...entry, reviews: visible(entry.reviews), status: deriveStatus(entry) };
}

function teamDetail(teamId: number): TeamDetail {
  return {
    ...findTeam(teamId),
    members: teamMembers(teamId),
    charter_items: db.charterItems.filter((c) => c.team_id === teamId),
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function elapsedFraction(assignment: Assignment): number {
  const start = Date.parse(assignment.start_date);
  const due = Date.parse(assignment.due_date);
  const t = (Date.parse(now()) - start) / (due - start);
  return Math.min(1, Math.max(0, t));
}

// ---- Assignments ----

export function createAssignment(body: CreateAssignmentBody): Promise<AssignmentDetail> {
  if (Date.parse(body.due_date) <= Date.parse(body.start_date)) {
    badRequest("due_date must be after start_date");
  }
  const join_code = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  const assignment: Assignment = {
    id: nextId(db.assignments),
    title: body.title,
    start_date: body.start_date,
    due_date: body.due_date,
    join_code,
    checkpoints: [0.33, 0.66],
  };
  db.assignments.push(assignment);
  return clone(assignmentDetail(assignment));
}

export function getAssignment(assignmentId: number): Promise<AssignmentDetail> {
  return clone(assignmentDetail(findAssignment(assignmentId)));
}

export function getOverview(assignmentId: number): Promise<Overview> {
  const assignment = findAssignment(assignmentId);
  const teams = db.teams
    .filter((t) => t.assignment_id === assignmentId)
    .map((team) => {
      // RULES.md team health: amber = disputed entry. Alerts never count (teachers are never notified).
      const disputed_entries = visible(db.entries)
        .filter((e) => e.team_id === team.id)
        .filter((e) => deriveStatus(e) === "disputed").length;
      const flagged_pastes = visible(db.pastes).filter((p) => p.team_id === team.id && p.flagged).length;
      const health: TeamHealth = disputed_entries > 0 ? "amber" : "green";
      return {
        id: team.id,
        name: team.name,
        charter_locked: team.charter_locked,
        member_count: teamMembers(team.id).length,
        health,
        disputed_entries,
        flagged_pastes,
      };
    });
  return clone({
    assignment: { ...assignment, join_url: joinUrl(assignment.join_code) },
    t: elapsedFraction(assignment),
    teams,
  });
}

export function getJoinInfo(joinCode: string): Promise<AssignmentDetail> {
  const assignment = find(
    db.assignments.find((a) => a.join_code.toUpperCase() === joinCode.toUpperCase()),
    "Join code",
  );
  return clone(assignmentDetail(assignment));
}

// ---- Teams and charter ----

export function createTeam(assignmentId: number, name: string): Promise<Team> {
  findAssignment(assignmentId);
  const team: Team = { id: nextId(db.teams), assignment_id: assignmentId, name, charter_locked: false };
  db.teams.push(team);
  return clone(team);
}

export function joinTeam(teamId: number, name: string): Promise<Member> {
  findTeam(teamId);
  const member: Member = { id: nextId(db.members), team_id: teamId, name };
  db.members.push(member);
  return clone(member);
}

export function getTeam(teamId: number): Promise<TeamDetail> {
  return clone(teamDetail(teamId));
}

export function saveCharter(teamId: number, items: CharterItemInput[]): Promise<TeamDetail> {
  if (findTeam(teamId).charter_locked) badRequest("Charter is locked");
  const memberIds = new Set(teamMembers(teamId).map((m) => m.id));
  for (const item of items) {
    if (!(0 <= item.start_pct && item.start_pct < item.end_pct && item.end_pct <= 1)) {
      badRequest("Time window must satisfy 0 <= start_pct < end_pct <= 1");
    }
    if (item.planned_points <= 0) badRequest("planned_points must be greater than 0");
    if (!memberIds.has(item.member_id)) badRequest("member_id is not in this team");
  }
  db.charterItems = db.charterItems.filter((c) => c.team_id !== teamId);
  let id = nextId(db.charterItems);
  for (const item of items) db.charterItems.push({ ...item, id: id++, team_id: teamId });
  return clone(teamDetail(teamId));
}

export function lockCharter(teamId: number): Promise<TeamDetail> {
  findTeam(teamId).charter_locked = true;
  return clone(teamDetail(teamId));
}

// ---- Ledger (append-only) ----

export function listEntries(teamId: number): Promise<Entry[]> {
  const rows = visible(db.entries.filter((e) => e.team_id === teamId));
  return clone(newestFirst(rows).map(presentEntry));
}

export function createEntry(teamId: number, body: CreateEntryBody): Promise<Entry> {
  findTeam(teamId);
  const entry: Entry = {
    member_id: body.member_id,
    description: body.description,
    size: body.size,
    charter_item_id: body.charter_item_id ?? null,
    evidence: body.evidence,
    id: nextId(db.entries),
    team_id: teamId,
    created_at: now(),
    status: "pending",
    reviews: [],
  };
  db.entries.push(entry);
  return clone(presentEntry(entry));
}

export function createReview(entryId: number, body: CreateReviewBody): Promise<Entry> {
  const entry = find(db.entries.find((e) => e.id === entryId), "Entry");
  if (entry.member_id === body.reviewer_id) badRequest("You can't review your own entry");
  if (entry.reviews.some((r) => r.reviewer_id === body.reviewer_id)) {
    badRequest("You have already reviewed this entry");
  }
  if (body.verdict === "dispute" && body.note.trim() === "") badRequest("A dispute needs a note");
  const review: Review = {
    ...body,
    id: nextId(db.entries.flatMap((e) => e.reviews)),
    entry_id: entryId,
    created_at: now(),
  };
  entry.reviews.push(review);
  return clone(presentEntry(entry));
}

// ---- Document and pastes ----

export function getDocument(teamId: number): Promise<Document> {
  findTeam(teamId);
  let doc = db.documents.find((d) => d.team_id === teamId);
  if (!doc) {
    // Created empty on first GET. Nobody has edited it yet, so updated_by is 0.
    doc = { team_id: teamId, content_html: "", content_text: "", updated_at: now(), updated_by: 0 };
    db.documents.push(doc);
  }
  return clone(doc);
}

export function saveDocument(teamId: number, body: SaveDocumentBody): Promise<Document> {
  findTeam(teamId);
  const doc: Document = {
    team_id: teamId,
    content_html: body.content_html,
    content_text: body.content_text,
    updated_at: now(),
    updated_by: body.member_id,
  };
  db.documents = [...db.documents.filter((d) => d.team_id !== teamId), doc];
  return clone(doc);
}

export function createPaste(teamId: number, body: CreatePasteBody): Promise<PasteEvent> {
  findTeam(teamId);
  const paste: PasteEvent = {
    ...body,
    id: nextId(db.pastes),
    team_id: teamId,
    preview: body.preview.slice(0, 120),
    label: null,
    label_note: "",
    flagged: !body.is_internal,
    created_at: now(),
  };
  db.pastes.push(paste);
  return clone(paste);
}

export function labelPaste(pasteId: number, body: LabelPasteBody): Promise<PasteEvent> {
  const paste = find(db.pastes.find((p) => p.id === pasteId), "Paste");
  if (paste.member_id !== body.member_id) throw new ApiError(403, "Only the person who pasted can label it");
  paste.label = body.label;
  paste.label_note = body.label_note;
  paste.flagged = false;
  return clone(paste);
}

export function listPastes(teamId: number): Promise<PasteEvent[]> {
  const rows = visible(db.pastes).filter((p) => p.team_id === teamId && !p.is_internal);
  return clone(newestFirst(rows));
}

// ---- Progress ----

export function getContribution(teamId: number): Promise<ContributionReport> {
  const t = elapsedFraction(findAssignment(findTeam(teamId).assignment_id));
  const entries = visible(db.entries).filter((e) => e.team_id === teamId);

  const rows = teamMembers(teamId).map((m) => {
    const expected = db.charterItems
      .filter((c) => c.member_id === m.id)
      .reduce((sum, c) => {
        const frac = Math.min(1, Math.max(0, (t - c.start_pct) / (c.end_pct - c.start_pct)));
        return sum + c.planned_points * frac;
      }, 0);
    const actual = entries
      .filter((e) => e.member_id === m.id && deriveStatus(e) === "confirmed")
      .reduce((sum, e) => sum + SIZE_POINTS[e.size], 0);
    return { m, expected, actual };
  });

  const ratios = rows.filter((r) => r.expected >= 1).map((r) => r.actual / r.expected);
  const teamMedian = median(ratios);

  const members = rows.map(({ m, expected, actual }): Contribution => {
      const progress_ratio = expected >= 1 ? actual / expected : null;
      let status: Contribution["status"] = "not_started_yet";
      if (expected >= 1) {
        const ratio = actual / expected;
        const behind = ratio < 0.5 * teamMedian || ratio < 0.25 || (actual === 0 && expected >= 2);
        status = behind ? "behind" : "on_track";
      }
      return {
        member_id: m.id,
        name: m.name,
        expected_points: expected,
        actual_points: actual,
        progress_ratio,
        status,
      };
    });
  return clone({ t, team_median: ratios.length > 0 ? teamMedian : null, members });
}

// Visibility per RULES.md: team alerts for everyone in the team, private ones only
// for the member they are about. The viewer must be in the team.
export function listAlerts(teamId: number, viewerId: number): Promise<Alert[]> {
  findTeam(teamId);
  if (!teamMembers(teamId).some((m) => m.id === viewerId)) badRequest(`Member ${viewerId} is not in this team`);
  const rows = visible(db.alerts).filter((a) => a.team_id === teamId);
  return clone(rows.filter((a) => a.level === "team" || a.member_id === viewerId));
}

// ---- Demo ----

export function getDemoTime(): Promise<DemoTime> {
  return clone({ now: now(), overridden: nowOverride !== null });
}

export function setDemoTime(value: string): Promise<DemoTime> {
  if (Number.isNaN(Date.parse(value))) badRequest("now must be an ISO 8601 datetime");
  nowOverride = value;
  return getDemoTime();
}

// Reloads the Group 7 fixtures. This is not the backend demo story from phase B7.
// Like the backend, returns the overview of assignment 1.
export function seedDemo(): Promise<Overview> {
  db = freshDb();
  nowOverride = null;
  return getOverview(1);
}

export function resetDemo(): Promise<Ok> {
  db = {
    assignments: [],
    teams: [],
    members: [],
    charterItems: [],
    entries: [],
    documents: [],
    pastes: [],
    alerts: [],
  };
  nowOverride = null;
  return clone({ ok: true as const });
}
