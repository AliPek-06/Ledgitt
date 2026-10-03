import { useEffect, useState } from "react";
import { getAssignment, getContribution, listAlerts } from "../../api/client";
import type { Alert, Assignment, Member, TeamDetail } from "../../api/types";
import { usePolling } from "../../hooks/usePolling";
import { dateAtPct, formatPct } from "../../lib/format";
import { type DisplayContribution, STATUS, displayStatus, formatPoints } from "../../lib/progress";
import ContributionChart from "./ContributionChart";
import EscalationLadder from "./EscalationLadder";
import ProgressTimeline from "./ProgressTimeline";

interface Props {
  team: TeamDetail;
  // The current user if they belong to the team. Alerts are only fetched for
  // members (API.md: viewer_id must be in the team), so others see no alerts.
  me?: Member;
}

const NO_ALERTS: Alert[] = [];

export default function ProgressTab({ team, me }: Props) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignmentError, setAssignmentError] = useState(false);
  const { data: report, error } = usePolling(() => getContribution(team.id), [team.id]);
  const { data: alerts } = usePolling(
    () => (me ? listAlerts(team.id, me.id) : Promise.resolve(NO_ALERTS)),
    [team.id, me?.id],
  );

  useEffect(() => {
    let cancelled = false;
    getAssignment(team.assignment_id)
      .then((a) => !cancelled && setAssignment(a))
      .catch(() => !cancelled && setAssignmentError(true));
    return () => {
      cancelled = true;
    };
  }, [team.assignment_id]);

  if (!report || !assignment) {
    return (
      <p className="text-stone-500">
        {error || assignmentError ? "We couldn't load progress just now. Please try again." : "Loading progress…"}
      </p>
    );
  }

  const visibleAlerts = alerts ?? NO_ALERTS;
  const rows: DisplayContribution[] = report.members.map((m) => ({
    ...m,
    status: displayStatus(m, me?.id, visibleAlerts),
  }));
  const next = assignment.checkpoints.find((c) => c > report.t);
  const totalDays = Math.round((Date.parse(assignment.due_date) - Date.parse(assignment.start_date)) / 86_400_000);
  const day = Math.min(totalDays, Math.max(0, Math.round(report.t * totalDays)));

  return (
    <div className="space-y-8">
      {!team.charter_locked && (
        <p className="rounded-lg bg-stone-100 px-5 py-4 text-stone-700">
          The charter isn't locked yet, so nothing is planned and check-ins haven't started.
        </p>
      )}

      {/* Where we are + timeline */}
      <section className="rounded-xl border border-stone-200 bg-white p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-6xl font-semibold tracking-tight text-stone-900">{formatPct(report.t)}</p>
            <p className="mt-1 text-lg text-stone-600">
              of the project time has passed · day {day} of {totalDays}
            </p>
          </div>
          <p className="text-lg text-stone-600">
            {next !== undefined
              ? `Next check-in: ${formatPct(next)} on ${dateAtPct(assignment.start_date, assignment.due_date, next)}`
              : "All check-ins are done"}
          </p>
        </div>
        <div className="mt-8">
          <ProgressTimeline
            assignment={assignment}
            t={report.t}
            alerts={visibleAlerts}
            members={team.members}
            viewerId={me?.id}
          />
        </div>
      </section>

      {/* Planned vs confirmed */}
      <section className="rounded-xl border border-stone-200 bg-white p-8">
        <h2 className="text-2xl font-semibold">Planned vs confirmed work</h2>
        <p className="mt-1 text-stone-600">
          Points each person's charter expects by now, next to the points teammates have confirmed.
        </p>
        {rows.length === 0 ? (
          <p className="mt-6 rounded-lg bg-stone-50 px-5 py-4 text-stone-600">
            No members yet. Progress shows up once people join and agree a charter.
          </p>
        ) : (
          <>
            <div className="mt-6">
              <ContributionChart members={rows} viewerId={me?.id} />
            </div>
            <ContributionTable members={rows} viewerId={me?.id} />
          </>
        )}
      </section>

      {/* Escalation ladder */}
      <section>
        <h2 className="text-2xl font-semibold">Check-ins</h2>
        <p className="mt-1 mb-5 text-stone-600">
          {me
            ? "At each checkpoint, anyone behind their plan gets a private nudge first. If they're still behind at the next one, the team gets a heads-up."
            : "Check-in alerts are only shown to members of this team."}
        </p>
        {me && <EscalationLadder alerts={visibleAlerts} members={team.members} viewerId={me.id} />}
      </section>
    </div>
  );
}

// The table view of the chart: every value readable without hovering.
function ContributionTable({ members, viewerId }: { members: DisplayContribution[]; viewerId?: number }) {
  return (
    <table className="mt-8 w-full text-left text-lg">
      <thead className="border-b border-stone-200 text-base text-stone-500">
        <tr>
          <th className="py-2 font-medium">Member</th>
          <th className="py-2 text-right font-medium">Planned by now</th>
          <th className="py-2 text-right font-medium">Confirmed</th>
          <th className="py-2 pl-8 font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {members.map((m) => {
          const s = STATUS[m.status];
          return (
            <tr key={m.member_id} className="border-b border-stone-100">
              <td className="py-3 font-medium">{m.member_id === viewerId ? `${m.name} (you)` : m.name}</td>
              <td className="py-3 text-right text-stone-700">{formatPoints(m.expected_points)}</td>
              <td className="py-3 text-right text-stone-700">{formatPoints(m.actual_points)}</td>
              <td className="py-3 pl-8">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-medium ${s.pill}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.icon} {s.label}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
