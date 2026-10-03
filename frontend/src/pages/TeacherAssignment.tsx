import { Link, useParams } from "react-router-dom";
import { getOverview } from "../api/client";
import type { TeamHealth, TeamOverview } from "../api/types";
import { useCurrentUser } from "../context/CurrentUserContext";
import { usePolling } from "../hooks/usePolling";
import { formatDateRange, plural } from "../lib/format";

// Red only appears for teacher-level alerts (health "red" means one is open).
const HEALTH: Record<TeamHealth, { dot: string; label: string }> = {
  green: { dot: "bg-emerald-500", label: "On track" },
  amber: { dot: "bg-amber-400", label: "Worth a check-in" },
  red: { dot: "bg-red-600", label: "Needs your support" },
};

export default function TeacherAssignment() {
  const assignmentId = Number(useParams().assignmentId);
  const { data: overview, error } = usePolling(() => getOverview(assignmentId), [assignmentId]);

  if (!overview) {
    return (
      <p className="text-stone-500">
        {error ? `We couldn't load this assignment: ${error.message}` : "Loading dashboard…"}
      </p>
    );
  }

  const { assignment, teams } = overview;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{assignment.title}</h1>
          <p className="mt-1 text-stone-600">{formatDateRange(assignment.start_date, assignment.due_date)}</p>
        </div>
        <p className="text-stone-600">
          Join code <span className="font-mono font-semibold text-stone-900">{assignment.join_code}</span>
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-stone-500">Couldn't refresh just now. Showing the last update.</p>
      )}

      {teams.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-600">
          No teams yet. Students can create one when they join with the code above.
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {teams.map((t) => (
            <TeamCard key={t.team.id} overview={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function TeamCard({ overview }: { overview: TeamOverview }) {
  const { team, members, health, open_disputes, teacher_alerts } = overview;
  const { setCurrentUser } = useCurrentUser();
  const nameOf = (id: number) => members.find((m) => m.id === id)?.name ?? `Member ${id}`;
  const h = HEALTH[health];

  return (
    // Opening a team as "teacher" makes the workspace read-only (no member identity).
    <Link
      to={`/team/${team.id}`}
      onClick={() => setCurrentUser("teacher")}
      className="block rounded-xl border border-stone-200 bg-white p-6 transition hover:border-accent hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{team.name}</h2>
        <span className="flex items-center gap-2 text-stone-700">
          <span className={`h-3.5 w-3.5 rounded-full ${h.dot}`} aria-hidden />
          {h.label}
        </span>
      </div>

      <p className="mt-2 text-stone-600">
        {members.length > 0 ? members.map((m) => m.name).join(", ") : "No members yet"}
      </p>

      <p className="mt-4 text-stone-700">
        {open_disputes === 0 ? "No open disputes" : `${plural(open_disputes, "open dispute")}`}
        {!team.charter_locked && <span className="text-stone-500"> · Charter not locked yet</span>}
      </p>

      {teacher_alerts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {teacher_alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
              <span className="font-medium">{nameOf(a.member_id)} needs some support.</span> {a.reason}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
