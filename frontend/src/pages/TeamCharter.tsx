import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getAssignment, getTeam, lockCharter, saveCharter } from "../api/client";
import type { Assignment, CharterItem, CharterItemInput, Member, TeamDetail } from "../api/types";
import CharterTimeline from "../components/CharterTimeline";
import Modal from "../components/Modal";
import RangeSlider from "../components/RangeSlider";
import { useCurrentUser } from "../context/CurrentUserContext";
import { dateAtPct, formatPct } from "../lib/format";

// A charter item being edited. `key` is local only, for React lists.
type Row = CharterItemInput & { key: string };

let nextKey = 0;
const newKey = () => `row-${++nextKey}`;

function toRows(items: CharterItem[]): Row[] {
  return items.map(({ member_id, responsibility, planned_points, start_pct, end_pct }) => ({
    key: newKey(),
    member_id,
    responsibility,
    planned_points,
    start_pct,
    end_pct,
  }));
}

function toInputs(rows: Row[]): CharterItemInput[] {
  return rows.map(({ key: _key, ...input }) => ({ ...input, responsibility: input.responsibility.trim() }));
}

function rowProblem(row: Row): string | null {
  if (row.responsibility.trim() === "") return "Describe the responsibility.";
  if (!Number.isInteger(row.planned_points) || row.planned_points < 1) return "Planned points must be a whole number of at least 1.";
  return null;
}

export default function TeamCharter() {
  const teamId = Number(useParams().teamId);
  const { currentUser } = useCurrentUser();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [savedJson, setSavedJson] = useState("[]");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);

  function applyTeam(t: TeamDetail) {
    const loaded = toRows(t.charter_items);
    setTeam(t);
    setRows(loaded);
    setSavedJson(JSON.stringify(toInputs(loaded)));
  }

  useEffect(() => {
    let cancelled = false;
    getTeam(teamId)
      .then(async (t) => {
        const a = await getAssignment(t.assignment_id);
        if (cancelled) return;
        applyTeam(t);
        setAssignment(a);
      })
      .catch(() => !cancelled && setLoadError("We couldn't load this team's charter."));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loadError) return <p className="rounded-lg bg-amber-50 px-5 py-4 text-amber-900">{loadError}</p>;
  if (!team || !assignment) return <p className="text-stone-500">Loading charter…</p>;

  const isMember = typeof currentUser === "number" && team.members.some((m) => m.id === currentUser);
  const readOnly = team.charter_locked || !isMember;
  const dirty = JSON.stringify(toInputs(rows)) !== savedJson;
  const problems = rows.map(rowProblem);
  const valid = problems.every((p) => p === null);

  function update(key: string, patch: Partial<CharterItemInput>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const memberId = isMember ? (currentUser as number) : team!.members[0]?.id;
    if (memberId === undefined) return;
    setRows((rs) => [
      ...rs,
      { key: newKey(), member_id: memberId, responsibility: "", planned_points: 2, start_pct: 0, end_pct: 0.25 },
    ]);
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      applyTeam(await saveCharter(teamId, toInputs(rows)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't save the charter just now. Please try again.");
      // A teammate may have locked the charter meanwhile; pick that up.
      getTeam(teamId)
        .then((t) => t.charter_locked && applyTeam(t))
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setError(null);
    setBusy(true);
    try {
      applyTeam(await lockCharter(teamId));
      setConfirmLock(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't lock the charter just now. Please try again.");
      setConfirmLock(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-medium text-accent">{assignment.title}</p>
          <h1 className="mt-1 text-3xl font-semibold">{team.name} charter</h1>
          <p className="mt-2 text-stone-600">Who does what, and when. Points use the ledger scale: S = 1, M = 2, L = 4.</p>
        </div>
        {team.charter_locked && (
          <Link to={`/team/${team.id}`} className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong">
            Go to workspace →
          </Link>
        )}
      </div>

      {team.charter_locked ? (
        <p className="mt-6 rounded-lg bg-accent-soft px-5 py-4 text-accent-strong">
          This charter is locked. Progress and early warnings are now measured against it.
        </p>
      ) : (
        !isMember && (
          <p className="mt-6 rounded-lg bg-stone-100 px-5 py-4 text-stone-700">
            You're viewing this charter. Switch to a member of {team.name} to edit it.
          </p>
        )
      )}

      <div className="mt-8">
        <CharterTimeline
          members={team.members}
          items={rows}
          checkpoints={assignment.checkpoints}
          startDate={assignment.start_date}
          dueDate={assignment.due_date}
        />
      </div>

      <div className="mt-8 space-y-4">
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
            {readOnly ? "No charter items." : "No items yet. Add one for each piece of work, then agree it as a team."}
          </p>
        )}
        {rows.map((row, i) =>
          readOnly ? (
            <ReadOnlyRow key={row.key} row={row} members={team.members} assignment={assignment} />
          ) : (
            <EditRow
              key={row.key}
              row={row}
              problem={problems[i]}
              members={team.members}
              assignment={assignment}
              onChange={(patch) => update(row.key, patch)}
              onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
            />
          ),
        )}
      </div>

      {!readOnly && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button onClick={addRow} className="rounded-lg border border-stone-300 bg-white px-5 py-3 font-medium hover:border-accent">
            + Add item
          </button>
          <div className="flex-1" />
          <span className="text-stone-500">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <button
            onClick={save}
            disabled={!dirty || !valid || busy}
            className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            Save charter
          </button>
          <button
            onClick={() => setConfirmLock(true)}
            disabled={dirty || rows.length === 0 || busy}
            title={dirty ? "Save your changes before locking" : undefined}
            className="rounded-lg border border-accent px-5 py-3 font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
          >
            Lock charter
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{error}</p>}

      {confirmLock && (
        <Modal title="Lock the charter?" onClose={() => !busy && setConfirmLock(false)}>
          <p className="text-stone-700">
            Make sure everyone in {team.name} agrees first. Once it's locked, the plan can't be changed, and progress
            check-ins at each checkpoint will be measured against it.
          </p>
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={() => setConfirmLock(false)}
              disabled={busy}
              className="rounded-lg border border-stone-300 px-5 py-3 font-medium hover:border-stone-400"
            >
              Not yet
            </button>
            <button
              onClick={lock}
              disabled={busy}
              className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              {busy ? "Locking…" : "Yes, lock it"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function windowText(assignment: Assignment, start: number, end: number): string {
  return `${dateAtPct(assignment.start_date, assignment.due_date, start)} – ${dateAtPct(
    assignment.start_date,
    assignment.due_date,
    end,
  )} · ${formatPct(start)}–${formatPct(end)} of the project`;
}

function EditRow({
  row,
  problem,
  members,
  assignment,
  onChange,
  onRemove,
}: {
  row: Row;
  problem: string | null;
  members: Member[];
  assignment: Assignment;
  onChange: (patch: Partial<CharterItemInput>) => void;
  onRemove: () => void;
}) {
  const input =
    "rounded-lg border border-stone-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={row.member_id}
          onChange={(e) => onChange({ member_id: Number(e.target.value) })}
          aria-label="Member"
          className={`${input} w-40 bg-white`}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={row.responsibility}
          onChange={(e) => onChange({ responsibility: e.target.value })}
          placeholder="Responsibility, e.g. Background research"
          aria-label="Responsibility"
          className={`${input} min-w-64 flex-1`}
        />
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={Number.isNaN(row.planned_points) ? "" : row.planned_points}
            onChange={(e) => onChange({ planned_points: e.target.valueAsNumber })}
            aria-label="Planned points"
            className={`${input} w-20`}
          />
          <span className="text-stone-600">pts</span>
        </label>
        <button onClick={onRemove} className="px-2 py-2 text-stone-500 hover:text-stone-800" aria-label="Remove item">
          Remove
        </button>
      </div>
      <div className="mt-4">
        <RangeSlider
          start={row.start_pct}
          end={row.end_pct}
          checkpoints={assignment.checkpoints}
          label="Time window"
          onChange={(start_pct, end_pct) => onChange({ start_pct, end_pct })}
        />
        <p className="mt-1 text-sm text-stone-600">{windowText(assignment, row.start_pct, row.end_pct)}</p>
      </div>
      {problem && <p className="mt-2 text-sm text-amber-800">{problem}</p>}
    </div>
  );
}

function ReadOnlyRow({ row, members, assignment }: { row: Row; members: Member[]; assignment: Assignment }) {
  const name = members.find((m) => m.id === row.member_id)?.name ?? `Member ${row.member_id}`;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-stone-200 bg-white px-5 py-4">
      <span className="w-32 font-medium">{name}</span>
      <span className="flex-1">{row.responsibility}</span>
      <span className="text-stone-700">{row.planned_points} pts</span>
      <span className="text-sm text-stone-500">{windowText(assignment, row.start_pct, row.end_pct)}</span>
    </div>
  );
}
