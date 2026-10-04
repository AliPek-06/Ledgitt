// One scene per section of the /demo presentation. Every scene is a pure
// function of (step, elapsed ms since the step started): going back or jumping
// always renders exactly the right screen, and elapsed = Infinity is the
// finished state. Scenes reuse the live app's presentational components.

import type { ReactNode } from "react";
import type { Alert, CharterItemInput, Entry, Member } from "../api/types";
import AlertsBanner from "../components/AlertsBanner";
import CharterTimeline from "../components/CharterTimeline";
import { DocumentFrame } from "../components/document/DocumentEditor";
import FlaggedPastesPanel from "../components/document/FlaggedPastesPanel";
import { LabelPasteForm } from "../components/document/LabelPasteModal";
import { EntryCardView } from "../components/ledger/EntryCard";
import { LogWorkFormView, type LogWorkValues } from "../components/ledger/LogWorkForm";
import ContributionChart from "../components/progress/ContributionChart";
import EscalationLadder from "../components/progress/EscalationLadder";
import ProgressTimeline from "../components/progress/ProgressTimeline";
import { formatPct } from "../lib/format";
import { displayStatus } from "../lib/progress";
import { TeacherOverview } from "../pages/TeacherAssignment";
import * as S from "./script";

export interface SceneProps {
  step: number; // step within the current section (0, 1, 2, …)
  elapsed: number; // ms since the step started; Infinity once finished
}

const noop = () => {};
const member = (id: number) => S.members.find((m) => m.id === id) as Member;

// The text typed so far, one character every `perChar` ms from `start`.
function typed(text: string, elapsed: number, start: number, perChar: number): string {
  if (elapsed < start) return "";
  return text.slice(0, Math.floor((elapsed - start) / perChar) + 1);
}

function Heading({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="font-medium text-accent">{kicker}</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </div>
      {right}
    </div>
  );
}

// ---- Charter (section steps 0-2) ----

const NAME_MS = 55; // per character
const NAME_GAP = 120; // pause between names

export function CharterScene({ step, elapsed }: SceneProps) {
  // Step 0: names type in one by one. Later steps: all names, finished.
  let offset = 0;
  const shown: Member[] = [];
  for (const m of S.members) {
    const name = step === 0 ? typed(m.name, elapsed, offset, NAME_MS) : m.name;
    if (name) shown.push({ ...m, name });
    offset += m.name.length * NAME_MS + NAME_GAP;
  }

  // Step 1: each member's bars draw from zero width, one member after another.
  const items: CharterItemInput[] =
    step === 0
      ? []
      : S.charterItems.map((c) => {
          const order = S.members.findIndex((m) => m.id === c.member_id);
          const drawn = step > 1 || elapsed >= 100 + order * 200;
          return { ...c, end_pct: drawn ? c.end_pct : c.start_pct };
        });

  const locked = step === 2;

  return (
    <div className="demo-charter">
      <Heading
        kicker={S.assignment.title}
        title={`${S.team.name} charter`}
        right={
          locked ? (
            <span className="demo-lock flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-medium text-white">
              <Padlock /> Locked
            </span>
          ) : (
            <span className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-medium text-stone-600">
              Lock charter
            </span>
          )
        }
      />
      <p className="-mt-3 mb-4 text-stone-600">Who does what, and when. Points use the ledger scale: S = 1, M = 2, L = 4.</p>
      <CharterTimeline
        members={shown}
        items={items}
        checkpoints={S.assignment.checkpoints}
        startDate={S.assignment.start_date}
        dueDate={S.assignment.due_date}
      />
      {locked && (
        <p className="demo-pop mt-4 rounded-lg bg-accent-soft px-5 py-4 text-accent-strong" style={{ animationDelay: "300ms" }}>
          This charter is locked. Progress and early warnings are now measured against it.
        </p>
      )}
    </div>
  );
}

function Padlock() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden>
      <path className="demo-shackle" d="M5 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="2" y="9" width="14" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

// ---- Document (section steps 0-2) ----

// Slide 7 (Jordan labels the paste), paced slowly enough to follow (ms).
const LABEL_TIMING = {
  open: 200, // pop-up appears
  choose: 900, // "My own notes" selected
  typeFrom: 1400, // note starts typing
  perChar: 55, // "From my lecture notes" takes ~1.2 s
  save: 2750, // Save pressed ("Saving…")
  done: 3150, // pop-up closes, flag clears
};

const tint = (author: number, alpha: number) => `rgb(${S.AUTHOR_COLOR[author]} / ${alpha})`;

export function DocumentScene({ step, elapsed }: SceneProps) {
  const at = (ms: number) => elapsed >= ms;
  const tinted = step > 0 || at(150);

  // Step 1: the paste is flagged. Step 2: Jordan labels it and it clears.
  const modalOpen = step === 2 && at(LABEL_TIMING.open) && !at(LABEL_TIMING.done);
  const labelled = step === 2 && at(LABEL_TIMING.done);
  const flagged = (step === 1 && at(200)) || (step === 2 && !labelled);

  const viewer = step === 2 ? member(S.JORDAN) : step === 1 ? member(S.MAYA) : undefined;
  const pastes = flagged ? [S.paste] : [];

  return (
    <div className="grid items-start gap-5 grid-cols-[1fr_17rem]">
      <div>
        <DocumentFrame
          editable
          status={
            <span className="text-stone-500">
              <span className="text-emerald-600">✓ </span>Saved
            </span>
          }
        >
          <div className="ledger-doc px-7 py-4" style={{ minHeight: 0, lineHeight: 1.55 }}>
            <h1 style={{ fontSize: "1.25rem" }}>{S.DOCUMENT_TITLE}</h1>
            {S.paragraphs.map((p, i) => {
              const isPaste = i === S.PASTED_PARAGRAPH;
              return (
                <p
                  key={i}
                  className="demo-para -mx-2 rounded-md px-2 py-0.5 text-[14.5px]"
                  style={{
                    backgroundColor: tinted ? tint(p.author, 0.11) : "transparent",
                    outline: `3px solid ${isPaste && flagged ? "rgb(245 158 11)" : "transparent"}`,
                    outlineOffset: 2,
                  }}
                >
                  {p.text}
                </p>
              );
            })}
          </div>
        </DocumentFrame>
      </div>

      <div className="space-y-4">
        <AuthorLegend visible={tinted} />
        <div className="demo-pop-items">
          <FlaggedPastesPanel pastes={pastes} members={S.members} me={viewer} onLabel={noop} />
        </div>
        {labelled && (
          <p className="demo-pop rounded-lg border border-stone-200 bg-white px-4 py-3 text-stone-700">
            Jordan labelled it <span className="font-medium">My own notes</span>: “{S.PASTE_LABEL_NOTE}”
          </p>
        )}
      </div>

      {modalOpen && (
        <LabelPasteForm
          paste={S.paste}
          label={at(LABEL_TIMING.choose) ? "my_notes" : null}
          note={typed(S.PASTE_LABEL_NOTE, elapsed, LABEL_TIMING.typeFrom, LABEL_TIMING.perChar)}
          busy={at(LABEL_TIMING.save)}
          onLabel={noop}
          onNote={noop}
          onSubmit={noop}
          onClose={noop}
        />
      )}
    </div>
  );
}

function AuthorLegend({ visible }: { visible: boolean }) {
  const count = (id: number) => S.paragraphs.filter((p) => p.author === id).length;
  return (
    <div
      className="rounded-xl border border-stone-200 bg-white p-5 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <h2 className="text-lg font-semibold">Who wrote what</h2>
      <ul className="mt-3 space-y-2">
        {S.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <span className="h-4 w-4 rounded" style={{ background: tint(m.id, 0.35) }} aria-hidden />
            <span className="font-medium">{m.name}</span>
            <span className="text-stone-500">
              {count(m.id) === 0 ? "no paragraphs yet" : `${count(m.id)} paragraph${count(m.id) > 1 ? "s" : ""}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Ledger (section steps 0-2) ----

const EMPTY_FORM: LogWorkValues = { description: "", size: "M", charterItemId: null, links: [] };

export function LedgerScene({ step, elapsed }: SceneProps) {
  const at = (ms: number) => elapsed >= ms;
  const maya = member(S.MAYA);

  // Step 0: Maya fills in the form and logs it.
  let values = EMPTY_FORM;
  let submitting = false;
  let logged = step > 0;
  if (step === 0) {
    logged = at(1350);
    submitting = at(1150) && !logged;
    if (!logged) {
      values = {
        description: typed(S.MAYA_ENTRY_TEXT, elapsed, 100, 12),
        size: "M",
        charterItemId: at(780) ? S.RESEARCH_ITEM : null,
        links: at(950) ? [S.MAYA_EVIDENCE] : [],
      };
    }
  }

  // Step 1: Jordan's and Priya's confirmations arrive one after the other.
  const confirmations = step < 1 ? [] : S.mayaConfirmations.filter((_, i) => step > 1 || at(i === 0 ? 300 : 900));
  const mayaEntry: Entry = {
    ...S.mayaEntry,
    reviews: confirmations,
    status: confirmations.length >= 2 ? "confirmed" : "pending",
  };

  // Step 2: Priya disputes Jordan's entry; paragraphs 4-5 light up in her colour.
  const disputed = step === 2 && at(450);
  const jordanEntry: Entry = {
    ...S.jordanEntry,
    reviews: disputed ? [S.priyaDispute] : [],
    status: disputed ? "disputed" : "pending",
  };

  const feed = [...(step === 2 ? [jordanEntry] : []), ...(logged ? [mayaEntry] : []), ...S.earlierEntries];

  return (
    <div className="grid items-start gap-8 grid-cols-[22rem_1fr]">
      {step < 2 ? (
        <LogWorkFormView
          team={S.team}
          me={maya}
          values={values}
          onChange={noop}
          submitting={submitting}
          justLogged={step === 0 && logged}
          canSubmit={values.description !== ""}
          onSubmit={(e) => e.preventDefault()}
          compact
        />
      ) : (
        <MiniDocument highlightPriya={step === 2 && at(800)} />
      )}
      <div className="demo-pop-items space-y-4">
        {feed.map((e) => (
          <EntryCardView key={e.id} entry={e} team={S.team} me={maya} />
        ))}
      </div>
    </div>
  );
}

// A small preview of the shared document, used beside the dispute.
function MiniDocument({ highlightPriya }: { highlightPriya: boolean }) {
  return (
    <div className="demo-pop rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Shared document</h2>
      <p className="text-sm text-stone-500">{S.DOCUMENT_TITLE}</p>
      <ol className="mt-4 space-y-2">
        {S.paragraphs.map((p, i) => {
          const lit = highlightPriya && p.author === S.PRIYA;
          return (
            <li
              key={i}
              className="demo-para rounded-md px-3 py-2 text-sm text-stone-700"
              style={{
                backgroundColor: tint(p.author, lit ? 0.3 : 0.08),
                boxShadow: lit ? `0 0 0 2px ${tint(S.PRIYA, 0.9)}` : "0 0 0 2px transparent",
              }}
            >
              <span className="font-medium">¶{i + 1} · {member(p.author).name}</span>
              <span className="block truncate text-stone-500">{p.text}</span>
            </li>
          );
        })}
      </ol>
      <p
        className="mt-3 text-sm font-medium transition-opacity duration-500"
        style={{ opacity: highlightPriya ? 1 : 0, color: tint(S.PRIYA, 1) }}
      >
        Paragraphs 4–5 were written by Priya.
      </p>
    </div>
  );
}

// ---- Checkpoints (section steps 0-2) ----

export function CheckpointsScene({ step, elapsed }: SceneProps) {
  const at = (ms: number) => elapsed >= ms;
  // The timeline glides to just past each checkpoint (CSS transition on left/width).
  // 0.335 / 0.665: just past each checkpoint, so the alerts are due, and it reads 33% / 66%.
  const t = step === 0 ? (at(60) ? 0.335 : 0.2) : step === 1 ? 0.335 : at(60) ? 0.665 : 0.335;
  const viewer = step === 0 ? S.SAM : S.MAYA;

  // What this viewer can see, appearing once the timeline has arrived.
  const arrived = at(1250);
  const alerts: Alert[] = step === 0 ? (arrived ? [S.privateAlert] : []) : step === 2 && arrived ? [S.teamAlert] : [];

  return (
    <div>
      <Heading kicker={S.assignment.title} title={S.team.name} />
      <div className="min-h-[7.5rem]">
        <AlertsBanner alerts={alerts} members={S.members} viewerId={viewer} />
      </div>
      <section className="demo-timeline mt-6 rounded-xl border border-stone-200 bg-white p-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-6xl font-semibold tracking-tight">{formatPct(t)}</p>
            <p className="mt-1 text-lg text-stone-600">of the project time has passed</p>
          </div>
        </div>
        <div className="mt-6">
          <ProgressTimeline assignment={S.assignment} t={t} alerts={alerts} members={S.members} viewerId={viewer} />
        </div>
      </section>
    </div>
  );
}

// ---- Progress ----

export function ProgressScene() {
  const viewer = S.MAYA;
  const visible = [S.teamAlert]; // what Maya can see at 66%
  const rows = S.report.members.map((m) => ({ ...m, status: displayStatus(m, viewer, visible) }));

  return (
    <div className="demo-fade">
      <Heading kicker={S.assignment.title} title={`${S.team.name} · Progress`} />
      <div className="grid items-start gap-5 grid-cols-[1fr_40rem]">
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Planned vs confirmed work</h2>
          <div className="mt-3">
            <ContributionChart members={rows} viewerId={viewer} />
          </div>
        </section>
        <div className="space-y-5">
          <section className="rounded-xl border border-stone-200 bg-white px-6 pt-3 pb-1">
            <h2 className="text-xl font-semibold">Timeline · {formatPct(S.report.t)}</h2>
            <ProgressTimeline assignment={S.assignment} t={S.report.t} alerts={visible} members={S.members} viewerId={viewer} />
          </section>
          {/* One full-width card: override the ladder's two-column grid. */}
          <div className="[&>ul]:grid-cols-1">
            <EscalationLadder alerts={visible} members={S.members} viewerId={viewer} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Teacher ----

export function TeacherScene() {
  return (
    <div className="demo-fade">
      <TeacherOverview overview={S.overview} interactive={false} />
    </div>
  );
}

// ---- Title card (first and last step) ----

export function CloseScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h1 className="demo-pop text-8xl font-semibold tracking-tight text-accent">Ledgitt</h1>
    </div>
  );
}
