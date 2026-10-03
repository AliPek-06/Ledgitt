import type { EntrySize, EntryStatus, EvidenceKind } from "../api/types";

// Points per size (RULES.md, Points) and what each size means for the form hint.
export const SIZES: Record<EntrySize, { points: number; label: string; hint: string }> = {
  S: { points: 1, label: "Small", hint: "An hour or two, e.g. tidying references" },
  M: { points: 2, label: "Medium", hint: "An afternoon, e.g. drafting a subsection" },
  L: { points: 4, label: "Large", hint: "A day or more, e.g. running a survey" },
};

// Confirms needed for "confirmed": ceil((team_size - 1) / 2) (RULES.md, Entry status).
export function confirmsNeeded(teamSize: number): number {
  return Math.ceil((teamSize - 1) / 2);
}

export const STATUS_STYLE: Record<EntryStatus, { label: string; chip: string }> = {
  pending: { label: "Pending", chip: "bg-stone-100 text-stone-700" },
  confirmed: { label: "Confirmed", chip: "bg-emerald-100 text-emerald-800" },
  disputed: { label: "Disputed", chip: "bg-amber-100 text-amber-900" },
};

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  url: "Link",
  file: "File",
  doc_activity: "Document",
  commit: "Commit",
};
