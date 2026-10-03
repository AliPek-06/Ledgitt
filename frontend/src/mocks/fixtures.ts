// Fixture data for one assignment: Group 7 (Maya, Jordan, Priya, Sam).
//
// Timeline: 2026-09-07 -> 2026-10-19 (6 weeks). Mock "now" is 2026-09-24,
// t ~= 0.41, so the 0.33 checkpoint has run and Sam got a private alert.
// Team size 4, so an entry needs ceil(3 / 2) = 2 confirms (RULES.md).

import type {
  Alert,
  Assignment,
  CharterItem,
  Document,
  Entry,
  Member,
  PasteEvent,
  Review,
  Team,
} from "../api/types";

export const MOCK_NOW = "2026-09-24T12:00:00Z";

export const assignments: Assignment[] = [
  {
    id: 1,
    title: "Research Methods: Group Report",
    start_date: "2026-09-07T09:00:00Z",
    due_date: "2026-10-19T09:00:00Z",
    join_code: "GRP7K4",
    checkpoints: [0.33, 0.66],
  },
];

// Groups 3 and 2 exist so the teacher dashboard shows all three health
// colours: Group 7 amber (disputes), Group 3 red (teacher alert), Group 2 green.
export const teams: Team[] = [
  { id: 1, assignment_id: 1, name: "Group 7", charter_locked: true },
  { id: 2, assignment_id: 1, name: "Group 3", charter_locked: true },
  { id: 3, assignment_id: 1, name: "Group 2", charter_locked: false },
];

export const MAYA = 1;
export const JORDAN = 2;
export const PRIYA = 3;
export const SAM = 4;
export const BEN = 6;

export const members: Member[] = [
  { id: MAYA, team_id: 1, name: "Maya" },
  { id: JORDAN, team_id: 1, name: "Jordan" },
  { id: PRIYA, team_id: 1, name: "Priya" },
  { id: SAM, team_id: 1, name: "Sam" },
  { id: 5, team_id: 2, name: "Alex" },
  { id: BEN, team_id: 2, name: "Ben" },
  { id: 7, team_id: 2, name: "Chloe" },
  { id: 8, team_id: 3, name: "Noah" },
  { id: 9, team_id: 3, name: "Lena" },
  { id: 10, team_id: 3, name: "Omar" },
];

export const charterItems: CharterItem[] = [
  { id: 1, team_id: 1, member_id: MAYA, responsibility: "Literature review", planned_points: 4, start_pct: 0.0, end_pct: 0.4 },
  { id: 2, team_id: 1, member_id: MAYA, responsibility: "Final edit and formatting", planned_points: 2, start_pct: 0.8, end_pct: 1.0 },
  { id: 3, team_id: 1, member_id: JORDAN, responsibility: "Survey design and data collection", planned_points: 6, start_pct: 0.1, end_pct: 0.5 },
  { id: 4, team_id: 1, member_id: PRIYA, responsibility: "Methodology section", planned_points: 4, start_pct: 0.1, end_pct: 0.6 },
  { id: 5, team_id: 1, member_id: SAM, responsibility: "Data analysis and charts", planned_points: 4, start_pct: 0.0, end_pct: 0.35 },
  { id: 6, team_id: 1, member_id: SAM, responsibility: "Presentation slides", planned_points: 2, start_pct: 0.6, end_pct: 1.0 },
];

let reviewId = 0;
function review(entry_id: number, reviewer_id: number, verdict: Review["verdict"], created_at: string, note = ""): Review {
  return { id: ++reviewId, entry_id, reviewer_id, verdict, note, created_at };
}

// Statuses here are already derived per RULES.md; the mock API re-derives
// them when reviews are added.
export const entries: Entry[] = [
  {
    id: 1, team_id: 1, member_id: MAYA, size: "M", charter_item_id: 1,
    description: "Collected and summarised 8 sources for the literature review",
    evidence: [{ kind: "doc_activity", ref: "doc#lit-review", label: "Lit review notes" }],
    created_at: "2026-09-09T15:20:00Z", status: "confirmed",
    reviews: [review(1, JORDAN, "confirm", "2026-09-09T18:00:00Z"), review(1, PRIYA, "confirm", "2026-09-10T08:30:00Z")],
  },
  {
    id: 2, team_id: 1, member_id: JORDAN, size: "S", charter_item_id: 3,
    description: "Drafted survey questions",
    evidence: [{ kind: "url", ref: "https://forms.example.com/draft-7", label: "Survey draft" }],
    created_at: "2026-09-11T11:00:00Z", status: "confirmed",
    reviews: [review(2, MAYA, "confirm", "2026-09-11T13:10:00Z"), review(2, SAM, "confirm", "2026-09-12T09:00:00Z")],
  },
  {
    id: 3, team_id: 1, member_id: PRIYA, size: "M", charter_item_id: 4,
    description: "Outlined the methodology section",
    evidence: [{ kind: "doc_activity", ref: "doc#methodology", label: "Methodology outline" }],
    created_at: "2026-09-14T10:45:00Z", status: "confirmed",
    reviews: [review(3, MAYA, "confirm", "2026-09-14T12:00:00Z"), review(3, JORDAN, "confirm", "2026-09-14T16:30:00Z")],
  },
  {
    id: 4, team_id: 1, member_id: MAYA, size: "M", charter_item_id: 1,
    description: "Wrote the first half of the literature review draft",
    evidence: [{ kind: "doc_activity", ref: "doc#lit-review", label: "Lit review draft" }],
    created_at: "2026-09-16T17:05:00Z", status: "confirmed",
    reviews: [review(4, PRIYA, "confirm", "2026-09-16T19:00:00Z"), review(4, SAM, "confirm", "2026-09-17T10:15:00Z")],
  },
  {
    id: 5, team_id: 1, member_id: JORDAN, size: "L", charter_item_id: 3,
    description: "Ran the pilot survey with 12 respondents",
    evidence: [{ kind: "file", ref: "pilot-results.csv", label: "Pilot results" }],
    created_at: "2026-09-18T14:00:00Z", status: "pending",
    reviews: [review(5, PRIYA, "confirm", "2026-09-18T20:00:00Z")],
  },
  {
    id: 6, team_id: 1, member_id: SAM, size: "S", charter_item_id: 5,
    description: "Set up the analysis spreadsheet",
    evidence: [{ kind: "url", ref: "https://sheets.example.com/analysis-7", label: "Analysis sheet" }],
    created_at: "2026-09-19T21:30:00Z", status: "disputed",
    reviews: [
      review(6, MAYA, "confirm", "2026-09-20T09:00:00Z"),
      review(6, JORDAN, "dispute", "2026-09-20T10:20:00Z", "The sheet only has column headers so far."),
    ],
  },
  {
    id: 7, team_id: 1, member_id: PRIYA, size: "M", charter_item_id: 4,
    description: "Wrote the sampling subsection",
    evidence: [{ kind: "doc_activity", ref: "doc#sampling", label: "Sampling subsection" }],
    created_at: "2026-09-21T13:15:00Z", status: "pending",
    reviews: [],
  },
  {
    id: 8, team_id: 1, member_id: MAYA, size: "S", charter_item_id: 1,
    description: "Formatted all references in APA style",
    evidence: [{ kind: "doc_activity", ref: "doc#references", label: "References" }],
    created_at: "2026-09-22T09:40:00Z", status: "disputed",
    reviews: [review(8, PRIYA, "dispute", "2026-09-22T11:00:00Z", "I formatted most of these on Sunday, see doc history.")],
  },
  {
    id: 9, team_id: 1, member_id: JORDAN, size: "M", charter_item_id: 3,
    description: "Cleaned and coded the pilot survey responses",
    evidence: [{ kind: "commit", ref: "a1b2c3d", label: "clean_responses.py" }],
    created_at: "2026-09-22T16:00:00Z", status: "confirmed",
    reviews: [review(9, MAYA, "confirm", "2026-09-22T18:30:00Z"), review(9, PRIYA, "confirm", "2026-09-23T08:00:00Z")],
  },
  {
    id: 10, team_id: 1, member_id: PRIYA, size: "S", charter_item_id: null,
    description: "Reviewed Jordan's survey export for errors",
    evidence: [],
    created_at: "2026-09-23T10:00:00Z", status: "pending",
    reviews: [review(10, JORDAN, "confirm", "2026-09-23T12:00:00Z")],
  },
  {
    id: 11, team_id: 1, member_id: SAM, size: "M", charter_item_id: 5,
    description: "Started exploratory charts of pilot data",
    evidence: [{ kind: "file", ref: "charts-v0.png", label: "Draft charts" }],
    created_at: "2026-09-24T10:00:00Z", status: "pending",
    reviews: [],
  },
];

export const documents: Document[] = [
  {
    team_id: 1,
    content_html:
      "<h1>Group 7 Report</h1><h2>Literature review</h2><p>Prior work on student group projects shows uneven contribution is common...</p><h2>Methodology</h2><p>We surveyed second-year students using a 15-item questionnaire.</p><h3>Sampling</h3><p>Participants were recruited through course forums.</p>",
    content_text:
      "Group 7 Report\nLiterature review\nPrior work on student group projects shows uneven contribution is common...\nMethodology\nWe surveyed second-year students using a 15-item questionnaire.\nSampling\nParticipants were recruited through course forums.",
    updated_at: "2026-09-23T21:10:00Z",
    updated_by: PRIYA,
  },
];

export const pasteEvents: PasteEvent[] = [
  {
    id: 1, team_id: 1, member_id: JORDAN, kind: "paste", char_count: 640,
    preview: "Survey methodology is a field of applied statistics concerned with the sampling of individual units from a population and associated techniques of survey data collection.".slice(0, 120),
    is_internal: false, label: null, label_note: "", flagged: true,
    created_at: "2026-09-21T22:05:00Z",
  },
  {
    id: 2, team_id: 1, member_id: PRIYA, kind: "paste", char_count: 310,
    preview: "We surveyed second-year students using a 15-item questionnaire. Participants were recruited through course forums and completed the survey online.".slice(0, 120),
    is_internal: true, label: null, label_note: "", flagged: false,
    created_at: "2026-09-23T21:05:00Z",
  },
];

export const alerts: Alert[] = [
  {
    id: 1, team_id: 1, member_id: SAM, checkpoint: 0.33, level: "private",
    reason: "At the 33% checkpoint you had 0 confirmed points against about 3.8 expected from your charter.",
    created_at: "2026-09-20T18:00:00Z", resolved: false,
  },
  // Mocks don't run checkpoints, so this teacher-level alert is set directly
  // to exercise the red state. In the real engine it needs a longer streak.
  {
    id: 2, team_id: 2, member_id: BEN, checkpoint: 0.33, level: "teacher",
    reason: "No confirmed work yet, and well behind the plan for this stage.",
    created_at: "2026-09-20T18:00:00Z", resolved: false,
  },
];
