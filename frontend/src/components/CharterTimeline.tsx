import type { CharterItemInput, Member } from "../api/types";
import { dateAtPct, formatPct } from "../lib/format";

interface Props {
  members: Member[];
  items: CharterItemInput[];
  checkpoints: number[];
  startDate: string;
  dueDate: string;
}

const BAR_ROW_REM = 2.5;

// Puts each item in the first sub-row where it doesn't overlap, so a member's
// overlapping items stack instead of hiding each other.
function stack(items: CharterItemInput[]): CharterItemInput[][] {
  const rows: CharterItemInput[][] = [];
  for (const item of [...items].sort((a, b) => a.start_pct - b.start_pct)) {
    const row = rows.find((r) => r[r.length - 1].end_pct <= item.start_pct);
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows;
}

export default function CharterTimeline({ members, items, checkpoints, startDate, dueDate }: Props) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div className="flex">
        <div className="w-36 shrink-0" />
        <div className="relative h-10 flex-1">
          {checkpoints.map((c) => (
            <div
              key={c}
              className="absolute bottom-1 -translate-x-1/2 text-center text-sm leading-tight text-stone-600"
              style={{ left: `${c * 100}%` }}
            >
              <div className="font-medium">Checkpoint {formatPct(c)}</div>
              <div className="text-stone-500">{dateAtPct(startDate, dueDate, c)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Checkpoint lines across every lane. */}
        <div className="pointer-events-none absolute inset-y-0 left-36 right-0">
          {checkpoints.map((c) => (
            <div
              key={c}
              className="absolute inset-y-0 border-l-2 border-dashed border-stone-300"
              style={{ left: `${c * 100}%` }}
            />
          ))}
        </div>

        {members.length === 0 && <p className="py-6 text-stone-500">No members yet.</p>}

        {members.map((m) => {
          const mine = items.filter((i) => i.member_id === m.id);
          const rows = stack(mine);
          const total = mine.reduce((sum, i) => sum + (Number.isFinite(i.planned_points) ? i.planned_points : 0), 0);
          return (
            <div key={m.id} className="flex items-center border-t border-stone-100 py-2">
              <div className="w-36 shrink-0 pr-3">
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-stone-500">{total} pts</div>
              </div>
              <div className="relative flex-1" style={{ height: `${Math.max(rows.length, 1) * BAR_ROW_REM}rem` }}>
                {rows.length === 0 && (
                  <div className="absolute inset-y-1 left-0 right-0 rounded-md border border-dashed border-stone-200" />
                )}
                {rows.map((row, r) =>
                  row.map((item, i) => (
                    <div
                      key={`${r}-${i}`}
                      title={`${item.responsibility || "Untitled"} · ${item.planned_points} pts · ${dateAtPct(startDate, dueDate, item.start_pct)} – ${dateAtPct(startDate, dueDate, item.end_pct)}`}
                      className="absolute flex items-center overflow-hidden rounded-md bg-accent px-2 text-sm font-medium text-white transition-all"
                      style={{
                        left: `${item.start_pct * 100}%`,
                        width: `${(item.end_pct - item.start_pct) * 100}%`,
                        top: `${r * BAR_ROW_REM + 0.25}rem`,
                        height: `${BAR_ROW_REM - 0.5}rem`,
                      }}
                    >
                      <span className="truncate">{item.responsibility || "Untitled"}</span>
                    </div>
                  )),
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex text-sm text-stone-500">
        <div className="w-36 shrink-0" />
        <div className="flex flex-1 justify-between">
          <span>Start · {dateAtPct(startDate, dueDate, 0)}</span>
          <span>Due · {dateAtPct(startDate, dueDate, 1)}</span>
        </div>
      </div>
    </div>
  );
}
