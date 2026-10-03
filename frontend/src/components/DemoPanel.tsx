import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAssignment, getDemoTime, getTeam, resetDemo, seedDemo, setDemoTime } from "../api/client";
import type { Assignment } from "../api/types";
import { useCurrentUser } from "../context/CurrentUserContext";
import { usePolling } from "../hooks/usePolling";
import { formatDateTime, formatPct } from "../lib/format";
import { refreshAll } from "../lib/refresh";

// The seeded demo story (mocks and backend seed alike): assignment 1, Group 7.
const DEMO_ASSIGNMENT_ID = 1;
const DEMO_USERS = [
  { name: "Maya", id: 1 },
  { name: "Jordan", id: 2 },
  { name: "Priya", id: 3 },
  { name: "Sam", id: 4 },
] as const;

type Visibility = "open" | "collapsed" | "hidden";
const STORAGE_KEY = "ledger.demoPanel";
const HOUR_MS = 3_600_000;

function loadVisibility(): Visibility {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "open" || v === "collapsed" || v === "hidden") return v;
  } catch {
    // Storage unavailable; use the default.
  }
  return "open";
}

// Ignore the D shortcut while the user is typing somewhere.
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

interface Props {
  // Called after seed/reset so the page remounts and reloads everything.
  onDataReplaced: () => void;
}

// Floating demo controls, on every page. D shows/hides it completely.
export default function DemoPanel({ onDataReplaced }: Props) {
  const { teamId, assignmentId } = useParams();
  const { currentUser, setCurrentUser } = useCurrentUser();
  const [visibility, setVisibility] = useState<Visibility>(loadVisibility);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: clock, refresh: refreshClock } = usePolling(getDemoTime, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, visibility);
    } catch {
      // Ignore; the panel state just won't survive a reload.
    }
  }, [visibility]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d" || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      setVisibility((v) => (v === "hidden" ? "open" : "hidden"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The assignment on screen (teacher or team page), else the demo assignment.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let id = DEMO_ASSIGNMENT_ID;
        if (assignmentId) id = Number(assignmentId);
        else if (teamId) id = (await getTeam(Number(teamId))).assignment_id;
        const a = await getAssignment(id);
        if (!cancelled) setAssignment(a);
      } catch {
        if (!cancelled) setAssignment(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, assignmentId, reloadKey]);

  if (visibility === "hidden") return null;

  const start = assignment ? Date.parse(assignment.start_date) : 0;
  const span = assignment ? Date.parse(assignment.due_date) - start : 1;
  const nowFraction = clock && assignment ? Math.min(1, Math.max(0, (Date.parse(clock.now) - start) / span)) : 0;
  const fraction = draft ?? nowFraction;
  const next = assignment?.checkpoints.find((c) => c > nowFraction + 1e-6);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function goTo(f: number) {
    if (!assignment) return;
    const iso = new Date(start + Math.min(1, Math.max(0, f)) * span).toISOString();
    await run(async () => {
      await setDemoTime(iso);
      setDraft(null);
      refreshClock();
      refreshAll();
    }, `Time set to ${formatPct(f)}`);
  }

  async function replaceData(action: () => Promise<unknown>, done: string) {
    await run(async () => {
      await action();
      setDraft(null);
      setConfirmReset(false);
      setReloadKey((k) => k + 1);
      onDataReplaced();
      refreshClock();
      refreshAll();
    }, done);
  }

  const button =
    "rounded-md border border-stone-200 px-2.5 py-1 text-stone-700 hover:border-stone-400 disabled:opacity-50";

  return (
    <aside
      aria-label="Demo controls"
      className="fixed bottom-4 right-4 z-40 w-[22rem] rounded-xl border border-stone-200 bg-white/95 text-sm text-stone-700 shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setVisibility((v) => (v === "open" ? "collapsed" : "open"))}
          className="flex items-center gap-2 font-medium text-stone-500 hover:text-stone-800"
          aria-expanded={visibility === "open"}
        >
          <span aria-hidden>{visibility === "open" ? "▾" : "▸"}</span>
          Demo
          {clock && assignment && visibility === "collapsed" && (
            <span className="font-normal text-stone-400">· {formatPct(nowFraction)}</span>
          )}
        </button>
        <span className="text-xs text-stone-400">Press D to hide</span>
      </div>

      {visibility === "open" && (
        <div className="space-y-4 border-t border-stone-100 px-4 pb-4 pt-3">
          {/* Time */}
          {assignment && clock ? (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-stone-900">{formatDateTime(new Date(start + fraction * span).toISOString())}</span>
                <span className="tabular-nums text-stone-500">{formatPct(fraction)}</span>
              </div>
              <div className="relative mt-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={fraction}
                  disabled={busy}
                  aria-label="Demo time"
                  onChange={(e) => setDraft(Number(e.target.value))}
                  onPointerUp={(e) => goTo(Number((e.target as HTMLInputElement).value))}
                  onKeyUp={(e) => draft !== null && goTo(Number((e.target as HTMLInputElement).value))}
                  className="relative z-10 w-full accent-accent"
                />
                {/* Checkpoint ticks, aligned with the thumb's travel (16px thumb). */}
                <div className="pointer-events-none relative h-3">
                  {assignment.checkpoints.map((c) => (
                    <span
                      key={c}
                      className="absolute top-0 h-2 w-px bg-stone-400"
                      style={{ left: `calc(8px + ${c} * (100% - 16px))` }}
                      title={`Checkpoint ${formatPct(c)}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-stone-400">{clock.overridden ? "Demo time" : "Real time"}</span>
                <button // An hour past the checkpoint, so t has clearly passed it and it gets evaluated.
                  onClick={() => next !== undefined && goTo(next + HOUR_MS / span)} disabled={busy || next === undefined} className={button}>
                  {next !== undefined ? `Jump to ${formatPct(next)} checkpoint` : "All checkpoints passed"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-stone-500">No assignment loaded. Seed the demo to start.</p>
          )}

          {/* Viewing as */}
          <div>
            <p className="mb-1.5 text-xs text-stone-400">View as</p>
            <div className="flex flex-wrap gap-1.5">
              {[...DEMO_USERS, { name: "Teacher", id: "teacher" as const }].map((u) => (
                <button
                  key={u.name}
                  onClick={() => setCurrentUser(u.id)}
                  aria-pressed={currentUser === u.id}
                  className={`rounded-md px-2.5 py-1 ${
                    currentUser === u.id ? "bg-stone-800 text-white" : "border border-stone-200 hover:border-stone-400"
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div className="flex items-center gap-2 border-t border-stone-100 pt-3">
            <button onClick={() => replaceData(seedDemo, "Demo seeded")} disabled={busy} className={button}>
              Seed demo
            </button>
            {confirmReset ? (
              <>
                <button onClick={() => replaceData(resetDemo, "Everything wiped")} disabled={busy} className={`${button} border-stone-400 text-stone-900`}>
                  Wipe everything?
                </button>
                <button onClick={() => setConfirmReset(false)} disabled={busy} className="px-1 text-stone-400 hover:text-stone-700">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmReset(true)} disabled={busy} className={button}>
                Reset
              </button>
            )}
          </div>

          {message && <p className="text-xs text-stone-500" aria-live="polite">{message}</p>}
        </div>
      )}
    </aside>
  );
}
