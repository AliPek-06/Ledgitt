import { listEntries } from "../../api/client";
import type { Member, TeamDetail } from "../../api/types";
import { usePolling } from "../../hooks/usePolling";
import EntryCard from "./EntryCard";
import LogWorkForm from "./LogWorkForm";

interface Props {
  team: TeamDetail;
  // The current user if they belong to this team; undefined means read-only.
  me?: Member;
}

export default function LedgerTab({ team, me }: Props) {
  const { data: entries, error, refresh } = usePolling(() => listEntries(team.id), [team.id]);

  return (
    <div className={me ? "grid items-start gap-8 lg:grid-cols-[22rem_1fr]" : ""}>
      {me && (
        <div className="lg:sticky lg:top-6">
          <LogWorkForm team={team} me={me} onLogged={refresh} />
        </div>
      )}

      <div>
        {!entries ? (
          <p className="text-stone-500">{error ? "We couldn't load the ledger." : "Loading the ledger…"}</p>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-600">
            Nothing logged yet. Work your team logs will appear here for teammates to confirm.
          </p>
        ) : (
          <ul className="space-y-4">
            {entries.map((e) => (
              <li key={e.id}>
                <EntryCard entry={e} team={team} me={me} onReviewed={refresh} />
              </li>
            ))}
          </ul>
        )}
        {entries && error && <p className="mt-4 text-sm text-stone-500">Couldn't refresh just now. Showing the last update.</p>}
      </div>
    </div>
  );
}
