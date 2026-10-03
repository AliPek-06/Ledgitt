import type { Member, PasteEvent } from "../../api/types";
import { formatDateTime } from "../../lib/format";

interface Props {
  pastes: PasteEvent[] | null;
  members: Member[];
  me?: Member;
  onLabel: (paste: PasteEvent) => void;
}

// Flagged pastes are visible to the whole team (RULES.md). Only the paster can label.
export default function FlaggedPastesPanel({ pastes, members, me, onLabel }: Props) {
  const flagged = (pastes ?? []).filter((p) => p.flagged);
  const nameOf = (id: number) =>
    id === me?.id ? "You" : (members.find((m) => m.id === id)?.name ?? `Member ${id}`);

  return (
    <aside className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Unlabelled text</h2>
      <p className="mt-1 text-sm text-stone-500">Large pastes and fast typing waiting for a quick label.</p>

      {pastes === null ? (
        <p className="mt-4 text-stone-500">Loading…</p>
      ) : flagged.length === 0 ? (
        <p className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-stone-600">All clear. Nothing to label.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {flagged.map((p) => (
            <li key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-medium">{nameOf(p.member_id)}</span>
                <span className="text-sm text-stone-500">{formatDateTime(p.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {p.char_count} characters · {p.kind === "paste" ? "pasted" : "typed in a burst"}
              </p>
              <p className="mt-2 line-clamp-3 text-stone-700">“{p.preview}…”</p>
              {p.member_id === me?.id && (
                <button
                  onClick={() => onLabel(p)}
                  className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                >
                  Label it
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
