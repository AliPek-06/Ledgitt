import { useEffect, useState } from "react";
import { getDocument, listPastes } from "../../api/client";
import type { Document, Member, PasteEvent, TeamDetail } from "../../api/types";
import { usePolling } from "../../hooks/usePolling";
import DocumentEditor from "./DocumentEditor";
import FlaggedPastesPanel from "./FlaggedPastesPanel";
import LabelPasteModal from "./LabelPasteModal";

interface Props {
  team: TeamDetail;
  me?: Member;
}

export default function DocumentTab({ team, me }: Props) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [labelling, setLabelling] = useState<PasteEvent | null>(null);
  const { data: pastes, refresh } = usePolling(() => listPastes(team.id), [team.id]);

  useEffect(() => {
    let cancelled = false;
    getDocument(team.id)
      .then((d) => !cancelled && setDoc(d))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  function onPasteEvent(event: PasteEvent) {
    refresh();
    if (!event.is_internal && me && event.member_id === me.id) setLabelling(event);
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
      {doc ? (
        <DocumentEditor key={team.id} teamId={team.id} initial={doc} me={me} onPasteEvent={onPasteEvent} />
      ) : (
        <p className="text-stone-500">{loadError ? "We couldn't load the document." : "Loading the document…"}</p>
      )}

      <div className="lg:sticky lg:top-6">
        <FlaggedPastesPanel pastes={pastes} members={team.members} me={me} onLabel={setLabelling} />
      </div>

      {labelling && me && (
        <LabelPasteModal
          paste={labelling}
          me={me}
          onClose={() => setLabelling(null)}
          onLabelled={() => {
            setLabelling(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
