import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTeam } from "../api/client";
import type { Member } from "../api/types";
import { useCurrentUser } from "../context/CurrentUserContext";

// Names of members seen on earlier team pages, so a stored member id can still be
// shown by name on pages without a team (e.g. /teacher/new). Per-browser only.
const NAMES_KEY = "ledger.memberNames";

function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function rememberNames(members: Member[]): void {
  try {
    const names = loadNames();
    for (const m of members) names[m.id] = m.name;
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // Storage unavailable; fall back to "Member #id".
  }
}

// Lists the members of the team in the current URL (if any) plus "Teacher".
export default function UserSwitcher() {
  const { teamId } = useParams();
  const { currentUser, setCurrentUser } = useCurrentUser();
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    getTeam(Number(teamId))
      .then((team) => {
        if (cancelled) return;
        rememberNames(team.members);
        setMembers(team.members);
      })
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // Keep a stored member id selectable even when it isn't in this team.
  const known = currentUser === "teacher" || members.some((m) => m.id === currentUser);

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Viewing as</span>
      <select
        className="rounded border border-slate-300 bg-white px-2 py-1"
        value={String(currentUser)}
        onChange={(e) => {
          const v = e.target.value;
          setCurrentUser(v === "teacher" ? "teacher" : Number(v));
        }}
      >
        <option value="teacher">Teacher</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
        {!known && <option value={currentUser}>{loadNames()[currentUser] ?? `Member #${currentUser}`}</option>}
      </select>
    </label>
  );
}
