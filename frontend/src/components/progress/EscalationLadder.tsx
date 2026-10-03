import type { Alert, Member } from "../../api/types";
import { formatPct } from "../../lib/format";
import { LADDER, LEVEL_RANK } from "../../lib/progress";

interface Props {
  // Only the alerts this viewer may see (already filtered by the API).
  alerts: Alert[];
  members: Member[];
  viewerId?: number;
}

// One ladder per member with visible alerts. The reached step is the highest
// level among their open alerts; when none are open they're back on track.
export default function EscalationLadder({ alerts, members, viewerId }: Props) {
  const memberIds = [...new Set(alerts.map((a) => a.member_id))];

  if (memberIds.length === 0) {
    return (
      <p className="rounded-xl bg-stone-50 px-6 py-5 text-lg text-stone-600">
        No check-ins to show. Nobody you can see has fallen behind their plan.
      </p>
    );
  }

  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {memberIds.map((id) => {
        const mine = alerts.filter((a) => a.member_id === id).sort((a, b) => a.checkpoint - b.checkpoint);
        const open = mine.filter((a) => !a.resolved);
        const aboutMe = id === viewerId;
        const name = aboutMe ? "You" : (members.find((m) => m.id === id)?.name ?? `Member ${id}`);
        const reached = open.length > 0 ? Math.max(...open.map((a) => LEVEL_RANK[a.level])) : -1;
        const backOnTrack = open.length === 0;

        return (
          <li key={id} className="rounded-xl border border-stone-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">{name}</h3>
              {backOnTrack ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-900">✓ Back on track</span>
              ) : (
                <span className="text-stone-500">
                  Flagged at {open.map((a) => formatPct(a.checkpoint)).join(" and ")}
                </span>
              )}
            </div>

            <ol className="mt-5 flex items-stretch">
              {LADDER.map((step, i) => {
                const hit = !backOnTrack && i <= reached;
                const current = !backOnTrack && i === reached;
                const tone = step.level === "private" ? "border-accent bg-accent-soft" : "border-amber-400 bg-amber-50";
                return (
                  <li key={step.level} className="flex flex-1 items-center">
                    {i > 0 && <div className={`h-1 w-6 shrink-0 ${hit ? "bg-stone-500" : "bg-stone-200"}`} aria-hidden />}
                    <div
                      className={`flex-1 rounded-lg border-2 px-4 py-3 ${
                        hit ? tone : "border-stone-200 bg-white text-stone-400"
                      } ${current ? "shadow-sm" : ""}`}
                      aria-current={current ? "step" : undefined}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                            hit ? "bg-stone-800 text-white" : "bg-stone-200 text-stone-500"
                          }`}
                        >
                          {i + 1}
                        </span>
                        {step.title}
                      </div>
                      <p className={`mt-1 text-sm ${hit ? "text-stone-700" : ""}`}>{step.who(aboutMe)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {backOnTrack && (
              <p className="mt-4 text-stone-600">
                {aboutMe ? "You were" : `${name} was`} flagged at {mine.map((a) => formatPct(a.checkpoint)).join(" and ")}, and
                {aboutMe ? " you're" : " is"} now keeping up with the plan.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
