import { useState } from "react";
import { ApiError, labelPaste } from "../../api/client";
import type { Member, PasteEvent, PasteLabel } from "../../api/types";
import Modal from "../Modal";

const OPTIONS: { value: PasteLabel; label: string; notePlaceholder: string }[] = [
  { value: "my_notes", label: "My own notes", notePlaceholder: "Anything to add? (optional)" },
  { value: "quote", label: "A quote (with source)", notePlaceholder: "Source, e.g. Smith 2021, p. 14" },
  { value: "moved", label: "Moved from elsewhere", notePlaceholder: "From where? (optional)" },
  { value: "other", label: "Other", notePlaceholder: "Tell your team a little more (optional)" },
];

interface Props {
  paste: PasteEvent;
  me: Member;
  onLabelled: () => void;
  // Closing without labelling leaves the paste flagged.
  onClose: () => void;
}

export default function LabelPasteModal({ paste, me, onLabelled, onClose }: Props) {
  const [label, setLabel] = useState<PasteLabel | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      await labelPaste(paste.id, { member_id: me.id, label, label_note: note.trim() });
      onLabelled();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't save the label just now. Please try again.");
      setBusy(false);
    }
  }

  const what = paste.kind === "paste" ? "pasted" : "added very quickly";
  const placeholder = OPTIONS.find((o) => o.value === label)?.notePlaceholder ?? "Optional note";

  return (
    <Modal title="Where's this text from?" onClose={() => !busy && onClose()}>
      <p className="text-stone-700">
        You {what} {paste.char_count} characters. A quick label helps your team know where it came from.
      </p>
      <p className="mt-3 rounded-lg bg-stone-50 px-4 py-3 text-stone-600">“{paste.preview}…”</p>

      <fieldset className="mt-5 grid grid-cols-2 gap-2">
        <legend className="sr-only">Source</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
              label === o.value ? "border-accent bg-accent-soft" : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <input
              type="radio"
              name="paste-label"
              checked={label === o.value}
              onChange={() => setLabel(o.value)}
              className="accent-accent"
            />
            <span className="font-medium">{o.label}</span>
          </label>
        ))}
      </fieldset>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        aria-label="Note"
        className="mt-4 w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />

      {error && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-amber-900">{error}</p>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button onClick={onClose} disabled={busy} className="px-4 py-3 font-medium text-stone-600 hover:text-stone-900">
          Later
        </button>
        <button
          onClick={submit}
          disabled={!label || busy}
          className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save label"}
        </button>
      </div>
    </Modal>
  );
}
