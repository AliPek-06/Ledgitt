import type { Alert, Member } from "../api/types";
import { formatPct } from "../lib/format";

interface Props {
  alerts: Alert[];
  members: Member[];
  viewerId?: number;
}

// Open alerts the current viewer may see (the API already filters by viewer).
// Wording stays supportive. There are two levels: private (streak 1) and team (2+).
export default function AlertsBanner({ alerts, members, viewerId }: Props) {
  // A member who stays behind keeps their earlier alerts open (they only resolve on
  // recovery), so show just each member's latest one: it supersedes the rest.
  const latest = new Map<number, Alert>();
  for (const a of alerts) {
    if (a.resolved) continue;
    const seen = latest.get(a.member_id);
    if (!seen || a.checkpoint > seen.checkpoint) latest.set(a.member_id, a);
  }
  const open = [...latest.values()];
  if (open.length === 0) return null;

  const nameOf = (id: number) => members.find((m) => m.id === id)?.name ?? "A teammate";

  return (
    <div className="mt-6 space-y-3">
      {open.map((a) => {
        const aboutMe = a.member_id === viewerId;
        const when = `At the ${formatPct(a.checkpoint)} checkpoint`;

        if (a.level === "private" && aboutMe) {
          return (
            <div key={a.id} className="rounded-xl border border-accent/20 bg-accent-soft px-6 py-5">
              <p className="text-sm font-medium uppercase tracking-wide text-accent">Just for you</p>
              <p className="mt-1 text-lg text-stone-900">You're a bit behind your plan for this stage.</p>
              <p className="mt-1 text-stone-700">{a.reason}</p>
              <p className="mt-2 text-sm text-stone-600">
                Only you can see this. Logging work you've done, or talking to your team about the plan, is a good next step.
              </p>
            </div>
          );
        }

        return (
          <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950">
            <p className="text-lg font-medium">
              {aboutMe ? "You have some catching up to do." : `${nameOf(a.member_id)} has some catching up to do.`}
            </p>
            <p className="mt-1">
              {when}: {a.reason}
            </p>
          </div>
        );
      })}
    </div>
  );
}
