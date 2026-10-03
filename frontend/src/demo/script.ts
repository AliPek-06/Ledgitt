// Scripted data and steps for the /demo presentation. No network calls: every
// screen in the presentation is rendered from this file.

import type {
  Alert,
  Assignment,
  CharterItem,
  ContributionReport,
  Entry,
  Member,
  Overview,
  PasteEvent,
  Review,
  TeamDetail,
} from "../api/types";

// ---- Team and charter ----

export const MAYA = 1;
export const JORDAN = 2;
export const PRIYA = 3;
export const SAM = 4;

export const assignment: Assignment = {
  id: 1,
  title: "Engineering Design Report",
  start_date: "2026-09-07T00:00:00Z",
  due_date: "2026-10-19T00:00:00Z", // 6 weeks
  join_code: "ENGDES",
  checkpoints: [0.33, 0.66],
};

export const members: Member[] = [
  { id: MAYA, team_id: 7, name: "Maya" },
  { id: JORDAN, team_id: 7, name: "Jordan" },
  { id: PRIYA, team_id: 7, name: "Priya" },
  { id: SAM, team_id: 7, name: "Sam" },
];

export const RESEARCH_ITEM = 1;

export const charterItems: CharterItem[] = [
  { id: RESEARCH_ITEM, team_id: 7, member_id: MAYA, responsibility: "Research and sources", planned_points: 10, start_pct: 0, end_pct: 0.5 },
  { id: 2, team_id: 7, member_id: JORDAN, responsibility: "Writing the main draft", planned_points: 12, start_pct: 0.1, end_pct: 0.9 },
  { id: 3, team_id: 7, member_id: PRIYA, responsibility: "Analysis and editing", planned_points: 10, start_pct: 0.3, end_pct: 0.75 },
  { id: 4, team_id: 7, member_id: SAM, responsibility: "Background research", planned_points: 4, start_pct: 0, end_pct: 0.3 },
  { id: 5, team_id: 7, member_id: SAM, responsibility: "Slides and presentation", planned_points: 6, start_pct: 0.7, end_pct: 1 },
];

export const team: TeamDetail = {
  id: 7,
  assignment_id: 1,
  name: "Group 7",
  charter_locked: true,
  members,
  charter_items: charterItems,
};

// ---- Shared document ----
// Authorship is a visual concept for the presentation only (no tracking logic).

export const AUTHOR_COLOR: Record<number, string> = {
  [MAYA]: "14 165 233", // sky
  [JORDAN]: "139 92 246", // violet
  [PRIYA]: "236 72 153", // pink
  [SAM]: "20 184 166", // teal
};

export const PASTED_PARAGRAPH = 2; // index of paragraph 3

export const paragraphs: { author: number; text: string }[] = [
  {
    author: MAYA,
    text: "Around 1440 in Mainz, the goldsmith Johannes Gutenberg began developing a way to print with movable metal type. He combined a hand mould for casting uniform letters, an oil-based ink that clung to metal, and a screw press adapted from those used to make wine and paper. By about 1455 his workshop had printed the Gutenberg Bible, around 180 copies of a book that a single scribe would have needed years to copy by hand.",
  },
  {
    author: JORDAN,
    text: "The technique spread quickly. Printers trained in Mainz carried it to other cities, and by 1500 presses were running in more than 250 towns across Europe. Venice became a major centre, where printers such as Aldus Manutius produced small, affordable editions of classical texts. Historians estimate that around twenty million books were printed before the end of the fifteenth century.",
  },
  {
    author: JORDAN,
    text: "Printing changed the economics of knowledge. Once the type had been set, each extra copy cost very little, so printed books became far cheaper than manuscripts and runs of several hundred copies quickly became normal. Identical copies meant that scholars in different cities could refer to the same page and the same wording, which made it easier to compare, correct and build on each other's work. Printers also began to standardise spelling, punctuation and page layout, and title pages, page numbers and indexes became common. Maps, diagrams and mathematical tables could be reproduced without the copying errors that crept into handmade versions, which mattered for navigation, astronomy, surveying and medicine. Cheap pamphlets and broadsheets spread news and arguments faster than ever before, and the Protestant Reformation of the 1500s showed how quickly printed ideas could travel.",
  },
  {
    author: PRIYA,
    text: "Cheaper books gradually encouraged more people to learn to read. Schools and universities could give students their own copies of grammars and textbooks, and reading began to move from a shared activity, where one person read aloud to many, towards private study. Literacy rose unevenly over the following centuries, faster in towns than in the countryside, but print carried written knowledge far beyond monasteries and royal courts.",
  },
  {
    author: PRIYA,
    text: "Gutenberg's basic method remained the main way of printing for more than three hundred years, until steam-powered presses arrived in the nineteenth century. Its legacy can be seen in mass literacy, public libraries and the scientific journal, and many historians count the printing press among the most important inventions of the last thousand years.",
  },
];

export const DOCUMENT_TITLE = "The Printing Press: A Short History";

const pastedText = paragraphs[PASTED_PARAGRAPH].text;

export const paste: PasteEvent = {
  id: 1,
  team_id: 7,
  member_id: JORDAN,
  kind: "paste",
  char_count: pastedText.length, // 890
  preview: pastedText.slice(0, 120),
  is_internal: false,
  label: null,
  label_note: "",
  flagged: true,
  created_at: "2026-09-13T17:12:00Z",
};

export const PASTE_LABEL_NOTE = "From my lecture notes";

// ---- Ledger ----

function review(id: number, entryId: number, reviewer: number, at: string, note = ""): Review {
  return { id, entry_id: entryId, reviewer_id: reviewer, verdict: note ? "dispute" : "confirm", note, created_at: at };
}

export const MAYA_ENTRY_TEXT = "Found 6 sources on Gutenberg and early printing";
export const MAYA_EVIDENCE = { url: "britannica.com/biography/Johannes-Gutenberg", label: "Britannica: Gutenberg" };

// Maya's new entry, before anyone has reviewed it.
export const mayaEntry: Entry = {
  id: 10,
  team_id: 7,
  member_id: MAYA,
  description: MAYA_ENTRY_TEXT,
  size: "M",
  charter_item_id: RESEARCH_ITEM,
  evidence: [{ kind: "url", ref: `https://${MAYA_EVIDENCE.url}`, label: MAYA_EVIDENCE.label }],
  created_at: "2026-09-16T10:00:00Z",
  status: "pending",
  reviews: [],
};

export const mayaConfirmations: Review[] = [
  review(101, 10, JORDAN, "2026-09-16T13:20:00Z"),
  review(102, 10, PRIYA, "2026-09-16T15:05:00Z"),
];

// Older work already in the feed.
export const earlierEntries: Entry[] = [
  {
    id: 8,
    team_id: 7,
    member_id: PRIYA,
    description: "Outlined the analysis plan and the chapter structure",
    size: "S",
    charter_item_id: 3,
    evidence: [],
    created_at: "2026-09-15T11:00:00Z",
    status: "confirmed",
    reviews: [review(81, 8, MAYA, "2026-09-15T14:00:00Z"), review(82, 8, JORDAN, "2026-09-15T16:30:00Z")],
  },
  {
    id: 7,
    team_id: 7,
    member_id: JORDAN,
    description: "Drafted the opening paragraphs on Gutenberg's press",
    size: "M",
    charter_item_id: 2,
    evidence: [],
    created_at: "2026-09-14T09:30:00Z",
    status: "confirmed",
    reviews: [review(71, 7, MAYA, "2026-09-14T12:00:00Z"), review(72, 7, PRIYA, "2026-09-14T15:00:00Z")],
  },
];

export const DISPUTE_NOTE = "Those paragraphs were mine; Jordan edited them.";

export const jordanEntry: Entry = {
  id: 12,
  team_id: 7,
  member_id: JORDAN,
  description: "Wrote the paragraphs on literacy and education",
  size: "L",
  charter_item_id: 2,
  evidence: [],
  created_at: "2026-09-25T10:00:00Z",
  status: "pending",
  reviews: [],
};

export const priyaDispute = review(121, 12, PRIYA, "2026-09-25T16:40:00Z", DISPUTE_NOTE);

// ---- Checkpoints and progress ----

export const privateAlert: Alert = {
  id: 1,
  team_id: 7,
  member_id: SAM,
  checkpoint: 0.33,
  level: "private",
  reason: "0 of 4.0 expected points confirmed",
  created_at: "2026-09-20T20:38:00Z",
  resolved: false,
};

export const teamAlert: Alert = {
  id: 2,
  team_id: 7,
  member_id: SAM,
  checkpoint: 0.66,
  level: "team",
  reason: "0 of 4.0 expected points confirmed",
  created_at: "2026-10-04T17:17:00Z",
  resolved: false,
};

// Expected points at t = 0.665 follow the RULES.md formula over the charter above.
// Jordan's disputed entry does not count.
export const report: ContributionReport = {
  t: 0.665,
  team_median: 1.03, // median of 1.2, 0.94, 1.11, 0
  members: [
    { member_id: MAYA, name: "Maya", expected_points: 10, actual_points: 12, progress_ratio: 1.2, status: "on_track" },
    { member_id: JORDAN, name: "Jordan", expected_points: 8.5, actual_points: 8, progress_ratio: 0.94, status: "on_track" },
    { member_id: PRIYA, name: "Priya", expected_points: 8.1, actual_points: 9, progress_ratio: 1.11, status: "on_track" },
    { member_id: SAM, name: "Sam", expected_points: 4, actual_points: 0, progress_ratio: 0, status: "behind" },
  ],
};

// ---- Teacher ----

export const overview: Overview = {
  assignment: { ...assignment, join_url: "http://localhost:5173/join/ENGDES" },
  t: 0.665,
  teams: [
    { id: 7, name: "Group 7", charter_locked: true, member_count: 4, health: "amber", disputed_entries: 1, flagged_pastes: 0 },
    { id: 3, name: "Group 3", charter_locked: true, member_count: 3, health: "green", disputed_entries: 0, flagged_pastes: 0 },
    { id: 5, name: "Group 5", charter_locked: true, member_count: 5, health: "green", disputed_entries: 0, flagged_pastes: 0 },
  ],
};

// ---- Steps ----

export const SECTIONS = ["Charter", "Document", "Ledger", "Checkpoints", "Progress", "Teacher"] as const;
export type Section = (typeof SECTIONS)[number];

export interface Step {
  section: Section | null; // null = the closing title card
  caption: string;
  viewer?: number | "teacher"; // shown as "Viewing as" when it matters
  duration: number; // ms of animation when the step is entered (all < 1500)
}

export const steps: Step[] = [
  { section: "Charter", caption: "A team forms and agrees who does what, and when.", duration: 1450 },
  { section: "Charter", caption: "Everyone is measured against their own plan, not an equal split.", duration: 1400 },
  { section: "Charter", caption: "Once locked, the plan becomes the baseline.", duration: 900 },
  { section: "Document", caption: "The shared document shows who wrote what.", duration: 900 },
  { section: "Document", caption: "Large pastes are flagged for the team to see.", viewer: MAYA, duration: 900 },
  { section: "Document", caption: "The writer explains it, and the warning clears. No accusation.", viewer: JORDAN, duration: 1450 },
  { section: "Ledger", caption: "Every kind of work gets logged, with evidence.", viewer: MAYA, duration: 1450 },
  { section: "Ledger", caption: "Teammates confirm it. Only confirmed work counts.", viewer: MAYA, duration: 1200 },
  { section: "Ledger", caption: "Disagreements surface early, backed by evidence.", viewer: MAYA, duration: 1300 },
  { section: "Checkpoints", caption: "First checkpoint: a private nudge, only Sam sees it.", viewer: SAM, duration: 1450 },
  { section: "Checkpoints", caption: "Nobody else is told. Sam gets a chance to catch up.", viewer: MAYA, duration: 400 },
  { section: "Checkpoints", caption: "Second checkpoint: still behind, so the team now knows.", viewer: MAYA, duration: 1450 },
  { section: "Progress", caption: "The whole picture: plans, real progress, and where it slipped.", viewer: MAYA, duration: 900 },
  { section: "Teacher", caption: "Teachers see progress. Alerts stay within the team.", viewer: "teacher", duration: 700 },
  { section: null, caption: "", duration: 500 },
];
