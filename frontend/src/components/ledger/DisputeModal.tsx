import { useState } from "react";
import Modal from "../Modal";

interface Props {
  authorName: string;
  description: string;
  busy: boolean;
  error: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
}

// A dispute always needs a note (API.md: POST /entries/{id}/reviews).
export default function DisputeModal({ authorName, description, busy, error, onSubmit, onClose }: Props) {
  const [note, setNote] = useState("");
  const ready = note.trim() !== "";

  return (
    <Modal title="Dispute this entry" onClose={onClose}>
      <p className="rounded-lg bg-stone-50 px-4 py-3 text-stone-700">
        <span className="font-medium">{authorName}:</span> {description}
      </p>
      <label className="mt-5 block">
        <span className="font-medium">What doesn't look right?</span>
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="e.g. I wrote most of this section. See the document history from Sunday."
          className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <p className="mt-2 text-sm text-stone-500">
        Your note is shared with the whole team, so keep it specific and kind. Disputes can't be undone.
      </p>
      {error && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-amber-900">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-stone-300 px-5 py-3 font-medium hover:border-stone-400"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(note.trim())}
          disabled={!ready || busy}
          className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send dispute"}
        </button>
      </div>
    </Modal>
  );
}
