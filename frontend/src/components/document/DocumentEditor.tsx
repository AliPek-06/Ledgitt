import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Transaction } from "@tiptap/pm/state";
import { createPaste, getDocument, saveDocument } from "../../api/client";
import type { CreatePasteBody, Document, Member, PasteEvent } from "../../api/types";
import { usePolling } from "../../hooks/usePolling";
import { BurstTracker, PREVIEW_CHARS, isInternalPaste, isLargePaste } from "../../lib/pasteDetection";

const AUTOSAVE_MS = 1500;
const RECENT_CUTS = 5;

type SaveState = "saved" | "unsaved" | "saving" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  unsaved: "Editing…",
  saving: "Saving…",
  error: "Couldn't save, retrying…",
};

interface Props {
  teamId: number;
  initial: Document;
  // The current user if they belong to the team; undefined means read-only.
  me?: Member;
  // Called after a paste or burst event has been stored.
  onPasteEvent: (event: PasteEvent) => void;
}

// Text inserted by a transaction (typing, autocomplete, etc.).
function insertedText(tr: Transaction): string {
  let text = "";
  for (const step of tr.steps) {
    const slice = (step as { slice?: { content: { size: number; textBetween: (...a: unknown[]) => string } } }).slice;
    if (slice && slice.content.size > 0) text += slice.content.textBetween(0, slice.content.size, "\n", "\n");
  }
  return text;
}

export default function DocumentEditor({ teamId, initial, me, onPasteEvent }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("saved");

  // Refs so the editor's callbacks (created once) always see current values.
  const meRef = useRef(me);
  meRef.current = me;
  const onPasteEventRef = useRef(onPasteEvent);
  onPasteEventRef.current = onPasteEvent;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const version = useRef(0);
  const lastKnownUpdate = useRef(initial.updated_at);
  const burst = useRef(new BurstTracker());
  const recentCuts = useRef<string[]>([]);
  const editorRef = useRef<Editor | null>(null);

  function record(body: Omit<CreatePasteBody, "member_id">) {
    const member = meRef.current;
    if (!member) return;
    createPaste(teamId, { ...body, member_id: member.id })
      .then((event) => onPasteEventRef.current(event))
      .catch(() => {
        // A lost event only means a missed label prompt; keep editing.
      });
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: initial.content_html,
    editable: me !== undefined,
    editorProps: {
      attributes: { class: "ledger-doc", "aria-label": "Shared document" },
      handleDOMEvents: {
        cut: (view) => {
          const { from, to } = view.state.selection;
          const text = view.state.doc.textBetween(from, to, "\n\n");
          if (text) recentCuts.current = [text, ...recentCuts.current].slice(0, RECENT_CUTS);
          return false;
        },
      },
      // Runs before the paste is applied, so the document text is "before".
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (isLargePaste(text)) {
          const docText = view.state.doc.textBetween(0, view.state.doc.content.size, "\n\n");
          record({
            kind: "paste",
            char_count: text.length,
            preview: text.slice(0, PREVIEW_CHARS),
            is_internal: isInternalPaste(text, docText, recentCuts.current),
          });
        }
        return false; // let the editor paste as normal
      },
    },
    onUpdate: ({ transaction }) => {
      // Bursts: only non-paste edits count. Drops (drag-moving text) and
      // undo/redo are skipped too.
      const uiEvent = transaction.getMeta("uiEvent");
      if (uiEvent !== "paste" && uiEvent !== "drop" && !transaction.getMeta("history$")) {
        const found = burst.current.add(Date.now(), insertedText(transaction));
        if (found) record({ kind: "burst", ...found, is_internal: false });
      }
      scheduleSave();
    },
  });
  editorRef.current = editor;

  // save/scheduleSave only read refs, so the closure captured by onUpdate on
  // the first render (when `editor` was still null) behaves correctly.
  async function save() {
    const editor = editorRef.current;
    const member = meRef.current;
    if (!editor || !member) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const savingVersion = version.current;
    setSaveState("saving");
    try {
      const doc = await saveDocument(teamId, {
        member_id: member.id,
        content_html: editor.getHTML(),
        content_text: editor.getText(),
      });
      lastKnownUpdate.current = doc.updated_at;
      // Further edits while saving keep the "unsaved" state and their own timer.
      if (version.current === savingVersion) setSaveState("saved");
      else setSaveState("unsaved");
    } catch {
      setSaveState("error");
      saveTimer.current = setTimeout(save, AUTOSAVE_MS * 2);
    }
  }

  function scheduleSave() {
    version.current += 1;
    setSaveState("unsaved");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, AUTOSAVE_MS);
  }

  // Flush a pending save when leaving the tab.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      if (saveTimer.current !== undefined) saveRef.current();
    },
    [],
  );

  // Depend on the boolean, not `me` (a new object on every team poll), and don't
  // emit an update: TipTap's setEditable emits one by default, which looked like
  // an edit and re-saved the document every 3 s, overwriting teammates' changes.
  const canEdit = me !== undefined;
  useEffect(() => {
    editor?.setEditable(canEdit, false);
  }, [editor, canEdit]);

  // Pick up teammates' saves, but only while this user has nothing unsaved and
  // isn't typing, so a refresh never overwrites their work or moves their cursor.
  const { data: remote } = usePolling(() => getDocument(teamId), [teamId]);
  useEffect(() => {
    if (!editor || !remote || remote.updated_at === lastKnownUpdate.current) return;
    if (saveState !== "saved" || editor.isFocused) return;
    lastKnownUpdate.current = remote.updated_at;
    editor.commands.setContent(remote.content_html, { emitUpdate: false });
  }, [editor, remote, saveState]);

  return (
    <DocumentFrame
      editable={me !== undefined}
      status={
        me && (
          <span className={saveState === "error" ? "text-amber-800" : "text-stone-500"} aria-live="polite">
            {saveState === "saved" && <span className="text-emerald-600">✓ </span>}
            {SAVE_LABEL[saveState]}
          </span>
        )
      }
    >
      <EditorContent editor={editor} className="px-8 py-6" />
    </DocumentFrame>
  );
}

// The document's box and header bar, shared with the /demo presentation's
// static document view.
export function DocumentFrame({
  editable,
  status,
  children,
}: {
  editable: boolean;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-6 py-3 text-sm">
        <span className="text-stone-500">{editable ? "Everyone in the team edits this document." : "Read-only"}</span>
        {status}
      </div>
      {children}
    </div>
  );
}
