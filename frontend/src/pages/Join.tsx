import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, createTeam, getJoinInfo, joinTeam } from "../api/client";
import type { AssignmentDetail, Team } from "../api/types";
import { useCurrentUser } from "../context/CurrentUserContext";
import { formatDateRange } from "../lib/format";

const NEW_TEAM = "new";

export default function Join() {
  const code = useParams().code ?? "";
  const navigate = useNavigate();
  const { setCurrentUser } = useCurrentUser();

  const [info, setInfo] = useState<AssignmentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | typeof NEW_TEAM | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJoinInfo(code)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        if (data.teams.length === 0) setChoice(NEW_TEAM);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(
          e instanceof ApiError && e.status === 404
            ? `We couldn't find an assignment with the code ${code}. Check the link with your teacher.`
            : "We couldn't load this assignment. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!info || choice === null) return;
    setError(null);
    setSubmitting(true);
    try {
      let team: Team;
      if (choice === NEW_TEAM) {
        team = await createTeam(info.id, newTeamName.trim());
      } else {
        team = info.teams.find((t) => t.id === choice)!;
      }
      const member = await joinTeam(team.id, name.trim());
      setCurrentUser(member.id);
      navigate(team.charter_locked ? `/team/${team.id}` : `/team/${team.id}/charter`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't add you to the team just now. Please try again.");
      setSubmitting(false);
    }
  }

  if (loadError) return <p className="mx-auto max-w-xl rounded-lg bg-amber-50 px-5 py-4 text-amber-900">{loadError}</p>;
  if (!info) return <p className="text-stone-500">Loading the assignment…</p>;

  const assignment = info;
  const { teams } = info;
  const canSubmit = name.trim() !== "" && choice !== null && (choice !== NEW_TEAM || newTeamName.trim() !== "");

  return (
    <section className="mx-auto max-w-xl">
      <p className="font-medium text-accent">You're joining</p>
      <h1 className="mt-1 text-3xl font-semibold">{assignment.title}</h1>
      <p className="mt-2 text-stone-600">{formatDateRange(assignment.start_date, assignment.due_date)}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-8 rounded-xl border border-stone-200 bg-white p-8">
        <fieldset>
          <legend className="font-medium">Choose your team</legend>
          <div className="mt-3 space-y-2">
            {teams.map((t) => (
              <TeamOption
                key={t.id}
                checked={choice === t.id}
                onSelect={() => setChoice(t.id)}
                label={t.name}
                hint={t.charter_locked ? "Charter agreed" : "Still planning"}
              />
            ))}
            <TeamOption
              checked={choice === NEW_TEAM}
              onSelect={() => setChoice(NEW_TEAM)}
              label="Start a new team"
            />
            {choice === NEW_TEAM && (
              <input
                autoFocus
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name, e.g. Group 4"
                className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            )}
          </div>
        </fieldset>

        <label className="block">
          <span className="font-medium">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How your teammates know you"
            className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>

        {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {submitting ? "Joining…" : "Join team"}
        </button>
      </form>
    </section>
  );
}

function TeamOption({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 ${
        checked ? "border-accent bg-accent-soft" : "border-stone-200 hover:border-stone-300"
      }`}
    >
      <span className="flex items-center gap-3">
        <input type="radio" name="team" checked={checked} onChange={onSelect} className="accent-accent" />
        <span className="font-medium">{label}</span>
      </span>
      {hint && <span className="text-sm text-stone-500">{hint}</span>}
    </label>
  );
}
