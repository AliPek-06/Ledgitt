import { Link, useParams, useSearchParams } from "react-router-dom";
import { getTeam, listAlerts } from "../api/client";
import AlertsBanner from "../components/AlertsBanner";
import LedgerTab from "../components/ledger/LedgerTab";
import { useCurrentUser } from "../context/CurrentUserContext";
import { usePolling } from "../hooks/usePolling";

const TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "document", label: "Document" },
  { id: "progress", label: "Progress" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function TeamWorkspace() {
  const teamId = Number(useParams().teamId);
  const { currentUser } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as TabId) : "ledger";

  const { data: team, error } = usePolling(() => getTeam(teamId), [teamId]);
  const { data: alerts } = usePolling(() => listAlerts(teamId, currentUser), [teamId, currentUser]);

  if (!team) {
    return <p className="text-stone-500">{error ? "We couldn't load this team." : "Loading workspace…"}</p>;
  }

  // Only members of this team can log or review; everyone else (incl. the
  // teacher) sees the workspace read-only.
  const me = typeof currentUser === "number" ? team.members.find((m) => m.id === currentUser) : undefined;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{team.name}</h1>
          <p className="mt-1 text-stone-600">{team.members.map((m) => m.name).join(", ")}</p>
        </div>
        <Link to={`/team/${team.id}/charter`} className="font-medium text-accent hover:underline">
          {team.charter_locked ? "View charter" : "Charter still being planned →"}
        </Link>
      </div>

      {!me && (
        <p className="mt-6 rounded-lg bg-stone-100 px-5 py-4 text-stone-700">
          {currentUser === "teacher"
            ? "You're viewing as the teacher. This workspace is read-only."
            : `You're not a member of ${team.name}, so this workspace is read-only.`}
        </p>
      )}

      {alerts && <AlertsBanner alerts={alerts} members={team.members} viewerId={me?.id} />}

      <nav className="mt-8 flex gap-1 border-b border-stone-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === "ledger" ? {} : { tab: t.id }, { replace: true })}
            className={`-mb-px border-b-2 px-5 py-3 text-lg font-medium ${
              tab === t.id ? "border-accent text-accent" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "ledger" && <LedgerTab team={team} me={me} />}
        {tab === "document" && <p className="text-stone-500">The shared document arrives in phase F5.</p>}
        {tab === "progress" && <p className="text-stone-500">The progress dashboard arrives in phase F6.</p>}
      </div>
    </section>
  );
}
