// Mirrors docs/API.md. Field names must match exactly.
// All timestamps are ISO 8601 strings; *_pct values are fractions 0.0-1.0.

export type ISODateTime = string;

// ---- Models ----

export interface Assignment {
  id: number;
  title: string;
  start_date: ISODateTime;
  due_date: ISODateTime;
  join_code: string;
  checkpoints: number[];
}

export interface Team {
  id: number;
  assignment_id: number;
  name: string;
  charter_locked: boolean;
}

export interface Member {
  id: number;
  team_id: number;
  name: string;
}

export interface CharterItem {
  id: number;
  team_id: number;
  member_id: number;
  responsibility: string;
  planned_points: number;
  start_pct: number;
  end_pct: number;
}

export type EntrySize = "S" | "M" | "L";
export type EntryStatus = "pending" | "confirmed" | "disputed";

export interface Entry {
  id: number;
  team_id: number;
  member_id: number;
  description: string;
  size: EntrySize;
  charter_item_id: number | null;
  evidence: Evidence[];
  created_at: ISODateTime;
  status: EntryStatus;
  reviews: Review[];
}

export type EvidenceKind = "url" | "file" | "doc_activity" | "commit";

export interface Evidence {
  kind: EvidenceKind;
  ref: string;
  label: string;
}

export type ReviewVerdict = "confirm" | "dispute";

export interface Review {
  id: number;
  entry_id: number;
  reviewer_id: number;
  verdict: ReviewVerdict;
  note: string;
  created_at: ISODateTime;
}

export interface Document {
  team_id: number;
  content_html: string;
  content_text: string;
  updated_at: ISODateTime;
  updated_by: number;
}

export type PasteKind = "paste" | "burst";
export type PasteLabel = "my_notes" | "quote" | "moved" | "other";

export interface PasteEvent {
  id: number;
  team_id: number;
  member_id: number;
  kind: PasteKind;
  char_count: number;
  preview: string;
  is_internal: boolean;
  label: PasteLabel | null;
  label_note: string;
  flagged: boolean;
  created_at: ISODateTime;
}

export type AlertLevel = "private" | "team" | "teacher";

export interface Alert {
  id: number;
  team_id: number;
  member_id: number;
  checkpoint: number;
  level: AlertLevel;
  reason: string;
  created_at: ISODateTime;
  resolved: boolean;
}

export type ContributionStatus = "on_track" | "behind" | "not_started_yet";

export interface Contribution {
  member_id: number;
  name: string;
  expected_points: number;
  actual_points: number;
  progress_ratio: number | null;
  status: ContributionStatus;
}

// ---- Response shapes ----

export interface AssignmentCreated extends Assignment {
  join_url: string;
}

export interface JoinInfo {
  assignment: Assignment;
  teams: Team[];
}

export interface TeamDetail extends Team {
  members: Member[];
  charter_items: CharterItem[];
}

export type TeamHealth = "green" | "amber" | "red";

export interface TeamOverview {
  team: Team;
  members: Member[];
  health: TeamHealth;
  open_disputes: number;
  teacher_alerts: Alert[];
}

export interface Overview {
  assignment: Assignment;
  teams: TeamOverview[];
}

export interface DemoTime {
  now: ISODateTime;
  overridden: boolean;
}

export interface Ok {
  ok: true;
}

// ---- Request bodies ----

export interface CreateAssignmentBody {
  title: string;
  start_date: ISODateTime;
  due_date: ISODateTime;
}

export interface CharterItemInput {
  member_id: number;
  responsibility: string;
  planned_points: number;
  start_pct: number;
  end_pct: number;
}

export interface CreateEntryBody {
  member_id: number;
  description: string;
  size: EntrySize;
  charter_item_id?: number | null;
  evidence: Evidence[];
}

export interface CreateReviewBody {
  reviewer_id: number;
  verdict: ReviewVerdict;
  note: string;
}

export interface SaveDocumentBody {
  member_id: number;
  content_html: string;
  content_text: string;
}

export interface CreatePasteBody {
  member_id: number;
  kind: PasteKind;
  char_count: number;
  preview: string;
  is_internal: boolean;
}

export interface LabelPasteBody {
  member_id: number;
  label: PasteLabel;
  label_note: string;
}

// Alerts are requested as a member id or "teacher".
export type Viewer = number | "teacher";
