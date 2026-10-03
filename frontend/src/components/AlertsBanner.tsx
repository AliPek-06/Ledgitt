import type { Alert, Member } from "../api/types";
import { formatPct } from "../lib/format";

interface Props {
  alerts: Alert[];
  members: Member[];
  viewerId?: number;
}

// Open alerts the current viewer may see (the API already filters by viewer).
// Wording stays supportive; red is reserved for teacher-level alerts.
export default function AlertsBanner({ alerts, members, viewerId }: Props) {
  const open = alerts.filter((a) => !a.resolved);
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

        if (a.level === "teacher") {
          return (
            <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-950">
              <p className="text-lg font-medium">
                {aboutMe ? "You could use some support." : `${nameOf(a.member_id)} could use some support.`} Your teacher
                can see this too.
              </p>
              <p className="mt-1">
                {when}: {a.reason}
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
