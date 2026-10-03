import { useState, type FormEvent } from "react";
import { ApiError, createEntry } from "../../api/client";
import type { EntrySize, Evidence, Member, TeamDetail } from "../../api/types";
import { SIZES } from "../../lib/entries";

interface Props {
  team: TeamDetail;
  me: Member;
  onLogged: () => void;
}

export interface LinkRow {
  url: string;
  label: string;
}

const input =
  "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

// Accepts "docs.google.com/..." as well as full URLs. Returns null if invalid.
// The URL parser alone is too lenient (browsers accept "https://not a link"),
// so also require no spaces, http(s), and a host with a dot or "localhost".
function normaliseUrl(raw: string): URL | null {
  const value = raw.trim();
  if (value === "" || /\s/.test(value)) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url;
  } catch {
    return null;
  }
}

export default function LogWorkForm({ team, me, onLogged }: Props) {
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<EntrySize>("M");
  const [charterItemId, setCharterItemId] = useState<number | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  const filledLinks = links.filter((l) => l.url.trim() !== "");
  const badLink = filledLinks.some((l) => normaliseUrl(l.url) === null);
  const canSubmit = description.trim() !== "" && !badLink && !submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const evidence: Evidence[] = filledLinks.map((l) => {
      const url = normaliseUrl(l.url)!;
      return { kind: "url", ref: url.href, label: l.label.trim() || url.hostname };
    });
    setError(null);
    setSubmitting(true);
    try {
      await createEntry(team.id, {
        member_id: me.id,
        description: description.trim(),
        size,
        charter_item_id: charterItemId,
        evidence,
      });
      setDescription("");
      setSize("M");
      setCharterItemId(null);
      setLinks([]);
      setJustLogged(true);
      setTimeout(() => setJustLogged(false), 2500);
      onLogged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't log that just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LogWorkFormView
      team={team}
      me={me}
      values={{ description, size, charterItemId, links }}
      onChange={(patch) => {
        if (patch.description !== undefined) setDescription(patch.description);
        if (patch.size !== undefined) setSize(patch.size);
        if (patch.charterItemId !== undefined) setCharterItemId(patch.charterItemId);
        if (patch.links !== undefined) setLinks(patch.links);
      }}
      error={error}
      submitting={submitting}
      justLogged={justLogged}
      canSubmit={canSubmit}
      onSubmit={onSubmit}
    />
  );
}

export interface LogWorkValues {
  description: string;
  size: EntrySize;
  charterItemId: number | null;
  links: LinkRow[];
}

interface ViewProps {
  team: TeamDetail;
  me: Member;
  values: LogWorkValues;
  onChange: (patch: Partial<LogWorkValues>) => void;
  error?: string | null;
  submitting?: boolean;
  justLogged?: boolean;
  canSubmit: boolean;
  onSubmit: (e: FormEvent) => void;
  // Shorter layout for the /demo presentation: sizes in one row, no hints.
  compact?: boolean;
}

// Presentational form: no API calls. LogWorkForm holds the state and submits;
// the /demo presentation fills it in with scripted values.
export function LogWorkFormView({
  team,
  me,
  values,
  onChange,
  error = null,
  submitting = false,
  justLogged = false,
  canSubmit,
  onSubmit,
  compact = false,
}: ViewProps) {
  const { description, size, charterItemId, links } = values;
  const myItems = team.charter_items.filter((c) => c.member_id === me.id);
  const setLink = (i: number, patch: Partial<LinkRow>) =>
    onChange({ links: links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Log your work</h2>

      <label className="block">
        <span className="font-medium">What did you do?</span>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={compact ? 2 : 3}
          placeholder="e.g. Drafted the sampling subsection"
          className={`${input} mt-2`}
        />
      </label>

      <fieldset>
        <legend className="font-medium">How big was it?</legend>
        <div className={compact ? "mt-2 grid grid-cols-3 gap-2" : "mt-2 space-y-2"}>
          {(Object.keys(SIZES) as EntrySize[]).map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                size === s ? "border-accent bg-accent-soft" : "border-stone-200 hover:border-stone-300"
              }`}
            >
              <input
                type="radio"
                name="size"
                checked={size === s}
                onChange={() => onChange({ size: s })}
                className="mt-1.5 accent-accent"
              />
              <span>
                <span className="font-medium">
                  {s} · {SIZES[s].label}
                </span>{" "}
                <span className="text-stone-500">({SIZES[s].points} pt{SIZES[s].points > 1 ? "s" : ""})</span>
                {!compact && <span className="block text-sm text-stone-600">{SIZES[s].hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {myItems.length > 0 && (
        <label className="block">
          <span className="font-medium">Part of your charter?</span>{" "}
          <span className="text-stone-500">(optional)</span>
          <select
            value={charterItemId ?? ""}
            onChange={(e) => onChange({ charterItemId: e.target.value === "" ? null : Number(e.target.value) })}
            className={`${input} mt-2 bg-white`}
          >
            <option value="">Not linked to a charter item</option>
            {myItems.map((c) => (
              <option key={c.id} value={c.id}>
                {c.responsibility}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <span className="font-medium">Evidence</span> <span className="text-stone-500">(optional)</span>
        <div className="mt-2 space-y-3">
          {links.map((l, i) => {
            const invalid = l.url.trim() !== "" && normaliseUrl(l.url) === null;
            return (
              <div key={i} className="space-y-2 rounded-lg bg-stone-50 p-3">
                <input
                  value={l.url}
                  onChange={(e) => setLink(i, { url: e.target.value })}
                  placeholder="Link, e.g. docs.google.com/…"
                  aria-label="Evidence link"
                  className={`${input} bg-white`}
                />
                <div className="flex gap-2">
                  <input
                    value={l.label}
                    onChange={(e) => setLink(i, { label: e.target.value })}
                    placeholder="Label (optional)"
                    aria-label="Evidence label"
                    className={`${input} bg-white`}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ links: links.filter((_, j) => j !== i) })}
                    className="px-2 text-stone-500 hover:text-stone-800"
                  >
                    Remove
                  </button>
                </div>
                {invalid && <p className="text-sm text-amber-800">That doesn't look like a link.</p>}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onChange({ links: [...links, { url: "", label: "" }] })}
            className="font-medium text-accent hover:underline"
          >
            + Add a link
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {submitting ? "Logging…" : justLogged ? "Logged ✓" : "Log it"}
      </button>
      {!compact && <p className="text-sm text-stone-500">Teammates confirm entries before they count toward progress.</p>}
    </form>
  );
}
