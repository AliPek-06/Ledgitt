// One async function per endpoint in docs/API.md. When VITE_USE_MOCKS=true
// every function returns data from src/mocks/ instead of calling the network.

import * as mock from "../mocks/mockApi";
import { ApiError } from "./errors";
import type {
  Alert,
  Assignment,
  AssignmentCreated,
  CharterItemInput,
  ContributionReport,
  CreateAssignmentBody,
  CreateEntryBody,
  CreatePasteBody,
  CreateReviewBody,
  DemoTime,
  Document,
  Entry,
  JoinInfo,
  LabelPasteBody,
  Member,
  Ok,
  Overview,
  PasteEvent,
  SaveDocumentBody,
  Team,
  TeamDetail,
  Viewer,
} from "./types";

export { ApiError };

export const API_BASE = "http://localhost:8000/api";
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      // Non-JSON error body; keep statusText.
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

// ---- Assignments ----

export async function createAssignment(body: CreateAssignmentBody): Promise<AssignmentCreated> {
  if (USE_MOCKS) return mock.createAssignment(body);
  return request("POST", "/assignments", body);
}

export async function getAssignment(assignmentId: number): Promise<Assignment> {
  if (USE_MOCKS) return mock.getAssignment(assignmentId);
  return request("GET", `/assignments/${assignmentId}`);
}

export async function getOverview(assignmentId: number): Promise<Overview> {
  if (USE_MOCKS) return mock.getOverview(assignmentId);
  return request("GET", `/assignments/${assignmentId}/overview`);
}

export async function getJoinInfo(joinCode: string): Promise<JoinInfo> {
  if (USE_MOCKS) return mock.getJoinInfo(joinCode);
  return request("GET", `/join/${encodeURIComponent(joinCode)}`);
}

// ---- Teams and charter ----

export async function createTeam(assignmentId: number, name: string): Promise<Team> {
  if (USE_MOCKS) return mock.createTeam(assignmentId, name);
  return request("POST", `/assignments/${assignmentId}/teams`, { name });
}

export async function joinTeam(teamId: number, name: string): Promise<Member> {
  if (USE_MOCKS) return mock.joinTeam(teamId, name);
  return request("POST", `/teams/${teamId}/members`, { name });
}

export async function getTeam(teamId: number): Promise<TeamDetail> {
  if (USE_MOCKS) return mock.getTeam(teamId);
  return request("GET", `/teams/${teamId}`);
}

export async function saveCharter(teamId: number, items: CharterItemInput[]): Promise<TeamDetail> {
  if (USE_MOCKS) return mock.saveCharter(teamId, items);
  return request("PUT", `/teams/${teamId}/charter`, { items });
}

export async function lockCharter(teamId: number): Promise<TeamDetail> {
  if (USE_MOCKS) return mock.lockCharter(teamId);
  return request("POST", `/teams/${teamId}/charter/lock`);
}

// ---- Ledger (append-only) ----

export async function listEntries(teamId: number): Promise<Entry[]> {
  if (USE_MOCKS) return mock.listEntries(teamId);
  return request("GET", `/teams/${teamId}/entries`);
}

export async function createEntry(teamId: number, body: CreateEntryBody): Promise<Entry> {
  if (USE_MOCKS) return mock.createEntry(teamId, body);
  return request("POST", `/teams/${teamId}/entries`, body);
}

export async function createReview(entryId: number, body: CreateReviewBody): Promise<Entry> {
  if (USE_MOCKS) return mock.createReview(entryId, body);
  return request("POST", `/entries/${entryId}/reviews`, body);
}

// ---- Document and pastes ----

export async function getDocument(teamId: number): Promise<Document> {
  if (USE_MOCKS) return mock.getDocument(teamId);
  return request("GET", `/teams/${teamId}/document`);
}

export async function saveDocument(teamId: number, body: SaveDocumentBody): Promise<Document> {
  if (USE_MOCKS) return mock.saveDocument(teamId, body);
  return request("PUT", `/teams/${teamId}/document`, body);
}

export async function createPaste(teamId: number, body: CreatePasteBody): Promise<PasteEvent> {
  if (USE_MOCKS) return mock.createPaste(teamId, body);
  return request("POST", `/teams/${teamId}/pastes`, body);
}

export async function labelPaste(pasteId: number, body: LabelPasteBody): Promise<PasteEvent> {
  if (USE_MOCKS) return mock.labelPaste(pasteId, body);
  return request("PATCH", `/pastes/${pasteId}/label`, body);
}

export async function listPastes(teamId: number): Promise<PasteEvent[]> {
  if (USE_MOCKS) return mock.listPastes(teamId);
  return request("GET", `/teams/${teamId}/pastes`);
}

// ---- Progress ----

export async function getContribution(teamId: number): Promise<ContributionReport> {
  if (USE_MOCKS) return mock.getContribution(teamId);
  return request("GET", `/teams/${teamId}/contribution`);
}

export async function listAlerts(teamId: number, viewer: Viewer): Promise<Alert[]> {
  if (USE_MOCKS) return mock.listAlerts(teamId, viewer);
  return request("GET", `/teams/${teamId}/alerts?viewer_id=${viewer}`);
}

// ---- Demo ----

export async function getDemoTime(): Promise<DemoTime> {
  if (USE_MOCKS) return mock.getDemoTime();
  return request("GET", "/demo/time");
}

export async function setDemoTime(now: string): Promise<DemoTime> {
  if (USE_MOCKS) return mock.setDemoTime(now);
  return request("POST", "/demo/time", { now });
}

export async function seedDemo(): Promise<Ok> {
  if (USE_MOCKS) return mock.seedDemo();
  return request("POST", "/demo/seed");
}

export async function resetDemo(): Promise<Ok> {
  if (USE_MOCKS) return mock.resetDemo();
  return request("POST", "/demo/reset");
}
