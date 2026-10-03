import type { AlertLevel, ContributionStatus } from "../api/types";

// Status colours are the fixed status palette (dataviz skill): never reused for
// anything else, and always shown with an icon + label, never colour alone.
export const STATUS: Record<ContributionStatus, { label: string; icon: string; color: string; pill: string }> = {
  on_track: { label: "On track", icon: "✓", color: "#0ca30c", pill: "bg-emerald-50 text-emerald-900" },
  behind: { label: "Some catching up to do", icon: "!", color: "#fab219", pill: "bg-amber-50 text-amber-900" },
  not_started_yet: { label: "Not started yet", icon: "–", color: "#78716c", pill: "bg-stone-100 text-stone-700" },
};

// "Planned by now" bars: a neutral, lighter than every status colour.
export const PLANNED_COLOR = "#d6d3d1";

// The escalation ladder (RULES.md: streak 1 = private, 2+ = team). No teacher level.
export const LADDER: { level: AlertLevel; title: string; who: (aboutMe: boolean) => string }[] = [
  { level: "private", title: "Private nudge", who: (aboutMe) => (aboutMe ? "Only you can see it" : "Only they can see it") },
  { level: "team", title: "Team heads-up", who: () => "The whole team can see it" },
];

export const LEVEL_RANK: Record<AlertLevel, number> = { private: 0, team: 1, teacher: 2 };

// 2.58 -> "2.6", 3 -> "3"
export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
