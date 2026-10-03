import type { Alert, Assignment, Member } from "../../api/types";
import { dateAtPct, formatPct } from "../../lib/format";

interface Props {
  assignment: Assignment;
  t: number;
  // Only the alerts this viewer may see (already filtered by the API).
  alerts: Alert[];
  members: Member[];
  viewerId?: number;
}

// Keeps edge labels inside the strip: left-aligned near 0, right-aligned near 1.
function anchor(pct: number): string {
  if (pct < 0.08) return "translate-x-0";
  if (pct > 0.92) return "-translate-x-full";
  return "-translate-x-1/2";
}

export default function ProgressTimeline({ assignment, t, alerts, members, viewerId }: Props) {
  const { start_date, due_date, checkpoints } = assignment;
  const atCheckpoint = (c: number) => alerts.filter((a) => Math.abs(a.checkpoint - c) < 1e-6);
  const mostAtOne = Math.max(0, ...checkpoints.map((c) => atCheckpoint(c).length));
  const nameOf = (id: number) => (id === viewerId ? "You" : (members.find((m) => m.id === id)?.name ?? `Member ${id}`));

  return (
    <div className="px-2">
      {/* Checkpoint labels above the strip */}
      <div className="relative h-14">
        {checkpoints.map((c) => (
          <div key={c} className={`absolute bottom-1 text-center ${anchor(c)}`} style={{ left: `${c * 100}%` }}>
            <div className={`font-semibold ${t >= c ? "text-stone-900" : "text-stone-500"}`}>Checkpoint {formatPct(c)}</div>
            <div className="text-sm text-stone-500">{dateAtPct(start_date, due_date, c)}</div>
          </div>
        ))}
      </div>

      {/* The strip: elapsed part tinted, checkpoint ticks, "now" line */}
      <div className="relative h-4">
        <div className="absolute inset-0 rounded-full bg-stone-200" />
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/25" style={{ width: `${t * 100}%` }} />
        {checkpoints.map((c) => (
          <div
            key={c}
            className={`absolute -top-1.5 h-7 w-1 -translate-x-1/2 rounded-full ${t >= c ? "bg-stone-700" : "bg-stone-400"}`}
            style={{ left: `${c * 100}%` }}
          />
        ))}
        <div className="absolute -top-3 h-10 w-1 -translate-x-1/2 rounded-full bg-accent" style={{ left: `${t * 100}%` }} />
      </div>

      {/* Below the strip: start/due, "Now", and the alerts at each checkpoint */}
      <div className="relative mt-3 h-8 text-sm text-stone-500">
        {/* Hide whichever end label the "Now" tag would sit on. */}
        {t > 0.15 && <span className="absolute left-0">Start · {dateAtPct(start_date, due_date, 0)}</span>}
        {t < 0.85 && <span className="absolute right-0">Due · {dateAtPct(start_date, due_date, 1)}</span>}
        <span
          className={`absolute whitespace-nowrap rounded-md bg-accent px-2 py-0.5 font-semibold text-white ${anchor(t)}`}
          style={{ left: `${t * 100}%` }}
        >
          Now · {formatPct(t)}
        </span>
      </div>

      {/* Absolutely placed under each checkpoint, so size the row to the busiest one. */}
      <div className="relative" style={{ height: `${mostAtOne * 2.4 + 0.5}rem` }}>
        {checkpoints.map((c) => {
          const here = atCheckpoint(c);
          if (here.length === 0) return null;
          return (
            <ul key={c} className={`absolute top-1 space-y-1.5 ${anchor(c)}`} style={{ left: `${c * 100}%` }}>
              {here.map((a) => (
                <li
                  key={a.id}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium ${
                    a.resolved
                      ? "border-stone-200 bg-white text-stone-500"
                      : a.level === "private"
                        ? "border-accent/30 bg-accent-soft text-accent-strong"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <span aria-hidden>{a.resolved ? "✓" : "●"}</span>
                  {nameOf(a.member_id)} · {a.level === "private" ? "private nudge" : "team heads-up"}
                  {a.resolved && " · resolved"}
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </div>
  );
}
