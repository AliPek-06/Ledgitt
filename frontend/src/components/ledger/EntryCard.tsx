import { useState, type ReactNode } from "react";
import { ApiError, createReview } from "../../api/client";
import type { Entry, Member, ReviewVerdict, TeamDetail } from "../../api/types";
import { EVIDENCE_LABEL, SIZES, STATUS_STYLE, confirmsNeeded } from "../../lib/entries";
import { formatDateTime } from "../../lib/format";
import DisputeModal from "./DisputeModal";

interface Props {
  entry: Entry;
  team: TeamDetail;
  me?: Member;
  onReviewed: () => void;
}

export default function EntryCard({ entry, team, me, onReviewed }: Props) {
  const [disputing, setDisputing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: number) =>
    id === me?.id ? "You" : (team.members.find((m) => m.id === id)?.name ?? `Member ${id}`);

  // Hidden on your own entries, after you've reviewed, and for read-only viewers.
  const canReview =
    me !== undefined && entry.member_id !== me.id && !entry.reviews.some((r) => r.reviewer_id === me.id);

  async function review(verdict: ReviewVerdict, note = "") {
    if (!me) return;
    setError(null);
    setBusy(true);
    try {
      await createReview(entry.id, { reviewer_id: me.id, verdict, note });
      setDisputing(false);
      onReviewed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't save your review just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <EntryCardView entry={entry} team={team} me={me}>
      {canReview && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => review("confirm")}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => {
              setError(null);
              setDisputing(true);
            }}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 hover:border-stone-400 disabled:opacity-50"
          >
            Dispute
          </button>
        </div>
      )}

      {error && !disputing && <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-amber-900">{error}</p>}

      {disputing && (
        <DisputeModal
          authorName={nameOf(entry.member_id)}
          description={entry.description}
          busy={busy}
          error={error}
          onSubmit={(note) => review("dispute", note)}
          onClose={() => {
            if (busy) return;
            setDisputing(false);
            setError(null);
          }}
        />
      )}
    </EntryCardView>
  );
}

interface ViewProps {
  entry: Entry;
  team: TeamDetail;
  me?: Member;
  // Review buttons, errors or a modal from the container (none in the demo).
  children?: ReactNode;
}

// Presentational card: no API calls. EntryCard adds reviewing; the /demo
// presentation renders this directly with scripted entries.
export function EntryCardView({ entry, team, me, children }: ViewProps) {
  const nameOf = (id: number) =>
    id === me?.id ? "You" : (team.members.find((m) => m.id === id)?.name ?? `Member ${id}`);
  const charterItem = team.charter_items.find((c) => c.id === entry.charter_item_id);
  const status = STATUS_STYLE[entry.status];
  const confirms = entry.reviews.filter((r) => r.verdict === "confirm").length;
  const needed = confirmsNeeded(team.members.length);

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{nameOf(entry.member_id)}</span>
        <span className="text-stone-500">{formatDateTime(entry.created_at)}</span>
        <span className="rounded-md border border-stone-200 px-2 py-0.5 text-sm text-stone-700">
          {entry.size} · {SIZES[entry.size].points} pt{SIZES[entry.size].points > 1 ? "s" : ""}
        </span>
        <span className="flex-1" />
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.chip}`}>{status.label}</span>
      </header>

      <p className="mt-3 text-lg">{entry.description}</p>
      {charterItem && <p className="mt-1 text-sm text-stone-500">Charter: {charterItem.responsibility}</p>}

      {entry.evidence.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {entry.evidence.map((ev, i) => (
            <li key={i} className="rounded-md bg-stone-100 px-3 py-1 text-sm">
              <span className="text-stone-500">{EVIDENCE_LABEL[ev.kind]}: </span>
              {ev.kind === "url" ? (
                <a href={ev.ref} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                  {ev.label || ev.ref}
                </a>
              ) : (
                <span className="font-medium" title={ev.ref}>
                  {ev.label || ev.ref}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {entry.reviews.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-stone-700">
          {entry.reviews.map((r) => (
            <li key={r.id}>
              {r.verdict === "confirm" ? (
                <span>
                  <span className="text-emerald-700">✓</span> {nameOf(r.reviewer_id)} confirmed
                </span>
              ) : (
                <span>
                  <span className="font-medium text-amber-800">{nameOf(r.reviewer_id)} disputed:</span> “{r.note}”
                </span>
              )}
              <span className="ml-2 text-sm text-stone-500">{formatDateTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      {entry.status === "pending" && (
        <p className="mt-3 text-sm text-stone-500">
          {confirms} of {needed} confirmation{needed === 1 ? "" : "s"} needed
        </p>
      )}
      {children}
    </article>
  );
}
