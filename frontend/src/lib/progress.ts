import type { Alert, AlertLevel, Contribution, ContributionStatus } from "../api/types";

// Status colours are the fixed status palette (dataviz skill): never reused for
// anything else, and always shown with an icon + label, never colour alone.
// "not_shared" is display-only: a teammate's on-track/behind status is theirs
// until a team-level alert makes it public (see displayStatus).
export type DisplayStatus = ContributionStatus | "not_shared";
export type DisplayContribution = Omit<Contribution, "status"> & { status: DisplayStatus };

export const STATUS: Record<DisplayStatus, { label: string; icon: string; color: string; pill: string }> = {
  on_track: { label: "On track", icon: "✓", color: "#0ca30c", pill: "bg-emerald-50 text-emerald-900" },
  behind: { label: "Some catching up to do", icon: "!", color: "#fab219", pill: "bg-amber-50 text-amber-900" },
  not_started_yet: { label: "Not started yet", icon: "–", color: "#78716c", pill: "bg-stone-100 text-stone-700" },
  not_shared: { label: "Private to them", icon: "", color: "#a8a29e", pill: "bg-stone-50 text-stone-500" },
};

// What a viewer may see of a member's status. A private nudge must stay private,
// so teammates never see "behind" (or "on track": a neutral pill only for the
// behind ones would give it away) unless an open team-level alert about that
// member is already visible to the whole team. Your own row, and the charter
// fact "not started yet", always show.
export function displayStatus(row: Contribution, viewerId: number | undefined, alerts: Alert[]): DisplayStatus {
  if (row.member_id === viewerId || row.status === "not_started_yet") return row.status;
  const publiclyBehind = alerts.some((a) => a.member_id === row.member_id && a.level === "team" && !a.resolved);
  return publiclyBehind ? row.status : "not_shared";
}

// "Planned by now" bars: a neutral, lighter than every status colour.
export const PLANNED_COLOR = "#d6d3d1";

// The escalation ladder (RULES.md: streak 1 = private, 2+ = team). No teacher level.
export const LADDER: { level: AlertLevel; title: string; who: (aboutMe: boolean) => string }[] = [
  { level: "private", title: "Private nudge", who: (aboutMe) => (aboutMe ? "Only you can see it" : "Only they can see it") },
  { level: "team", title: "Team heads-up", who: () => "The whole team can see it" },
];

export const LEVEL_RANK: Record<AlertLevel, number> = { private: 0, team: 1 };

// 2.58 -> "2.6", 3 -> "3"
export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
