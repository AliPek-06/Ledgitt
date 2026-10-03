import { Link, useParams } from "react-router-dom";
import { ApiError, getOverview } from "../api/client";
import type { TeamHealth, TeamOverview } from "../api/types";
import { useCurrentUser } from "../context/CurrentUserContext";
import { usePolling } from "../hooks/usePolling";
import { formatDateRange, plural } from "../lib/format";

// API.md health: amber = a disputed entry, green otherwise. Teachers are never
// notified, so no alert of any level reaches this page.
const HEALTH: Record<TeamHealth, { dot: string; label: string }> = {
  green: { dot: "bg-emerald-500", label: "On track" },
  amber: { dot: "bg-amber-400", label: "Worth a check-in" },
};

export default function TeacherAssignment() {
  const assignmentId = Number(useParams().assignmentId);
  const { data: overview, error } = usePolling(() => getOverview(assignmentId), [assignmentId]);

  if (!overview) {
    return (
      <p className="text-stone-500">
        {error
          ? error instanceof ApiError && error.status === 404
            ? "We couldn't find this assignment. Check the link and try again."
            : "We couldn't load this assignment just now. Please try again."
          : "Loading dashboard…"}
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
            <TeamCard key={t.id} overview={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function TeamCard({ overview }: { overview: TeamOverview }) {
  const { id, name, charter_locked, member_count, health, disputed_entries, flagged_pastes } = overview;
  const { setCurrentUser } = useCurrentUser();
  const h = HEALTH[health];

  return (
    // Opening a team as "teacher" makes the workspace read-only (no member identity).
    <Link
      to={`/team/${id}`}
      onClick={() => setCurrentUser("teacher")}
      className="block rounded-xl border border-stone-200 bg-white p-6 transition hover:border-accent hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{name}</h2>
        <span className="flex items-center gap-2 text-stone-700">
          <span className={`h-3.5 w-3.5 rounded-full ${h.dot}`} aria-hidden />
          {h.label}
        </span>
      </div>

      <p className="mt-2 text-stone-600">{member_count > 0 ? plural(member_count, "member") : "No members yet"}</p>

      <p className="mt-4 text-stone-700">
        {disputed_entries === 0 ? "No open disputes" : plural(disputed_entries, "open dispute")}
        {!charter_locked && <span className="text-stone-500"> · Charter not locked yet</span>}
      </p>

      {flagged_pastes > 0 && (
        <p className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-stone-700">
          {plural(flagged_pastes, "unlabelled paste")} in the team document.
        </p>
      )}
    </Link>
  );
}
