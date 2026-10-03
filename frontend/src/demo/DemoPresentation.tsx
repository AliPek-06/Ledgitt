// /demo: a presenter-driven walkthrough rendered from src/demo/script.ts.
// No network calls. Keys: Enter / Space / → next (or finish the running
// animation), ← back, R restart, H caption bar, Esc exit to the app.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./demo.css";
import {
  CharterScene,
  CheckpointsScene,
  CloseScene,
  DocumentScene,
  LedgerScene,
  ProgressScene,
  TeacherScene,
  type SceneProps,
} from "./scenes";
import { SECTIONS, members, steps, type Section } from "./script";

const STAGE_W = 1280;
const STAGE_H = 720;
const LAST = steps.length - 1;

// Scenes that are taller than the stage are drawn slightly smaller.
// Measured against the 540px content area at each section's tallest step.
const SCENE_ZOOM: Record<Section | "close", number> = {
  Charter: 0.88,
  Document: 0.76,
  Ledger: 0.78,
  Checkpoints: 0.84,
  Progress: 0.8,
  Teacher: 1,
  close: 1,
};

interface Position {
  index: number;
  start: number; // performance.now() when the step began
  settled: boolean; // true = show the finished state (no animation)
}

export default function DemoPresentation() {
  const navigate = useNavigate();
  const [pos, setPosState] = useState<Position>(() => ({ index: 0, start: performance.now(), settled: false }));
  // Key presses read the ref, so two quick presses never act on a stale step.
  const posRef = useRef(pos);
  const setPos = useCallback((p: Position) => {
    posRef.current = p;
    setPosState(p);
  }, []);
  const [now, setNow] = useState(() => performance.now());
  const [captionVisible, setCaptionVisible] = useState(true);
  const scale = useStageScale();

  const step = steps[pos.index];
  const elapsed = pos.settled ? Infinity : now - pos.start;
  const animating = elapsed < step.duration;

  // Tick only while a step is animating (always under 1.5 s). A timer rather
  // than requestAnimationFrame, which pauses in background tabs and would leave
  // the step "animating" forever; the final timeout guarantees it finishes.
  useEffect(() => {
    if (!animating) return;
    const interval = setInterval(() => setNow(performance.now()), 16);
    const end = setTimeout(() => setNow(performance.now()), Math.max(0, pos.start + step.duration - performance.now()) + 20);
    return () => {
      clearInterval(interval);
      clearTimeout(end);
    };
  }, [animating, pos, step.duration]);

  const goTo = useCallback(
    (index: number, animate: boolean) => {
      const t = performance.now();
      setNow(t);
      setPos({ index, start: t, settled: !animate });
    },
    [setPos],
  );

  const next = useCallback(() => {
    const p = posRef.current;
    // Judge from the real clock, not the last rendered tick.
    const stillAnimating = !p.settled && performance.now() - p.start < steps[p.index].duration;
    if (stillAnimating) setPos({ ...p, settled: true }); // finish, don't skip
    else if (p.index < LAST) goTo(p.index + 1, true);
  }, [goTo, setPos]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (key === "Enter" || key === " " || key === "ArrowRight") {
        e.preventDefault();
        if (!e.repeat) next();
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        const index = posRef.current.index;
        if (index > 0) goTo(index - 1, false); // going back shows the finished screen
      } else if (key === "r" || key === "R") {
        goTo(0, true);
      } else if (key === "h" || key === "H") {
        setCaptionVisible((v) => !v);
      } else if (key === "Escape") {
        navigate("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, goTo, navigate]);

  const sceneProps: SceneProps = { step: pos.index, elapsed };
  const sectionKey = step.section ?? "close";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-stone-900">
      <div
        className="demo-stage relative flex flex-col overflow-hidden bg-stone-50 text-stone-900"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, flexShrink: 0 }}
      >
        <TopBar section={step.section} viewer={step.viewer} />

        {/* translateZ(0) makes this the containing block for fixed elements, so
            dialogs (e.g. the label pop-up) cover the content, not the captions. */}
        <main
          className={`relative min-h-0 flex-1 overflow-hidden px-10 py-5 ${pos.settled ? "demo-settled" : ""}`}
          style={{ transform: "translateZ(0)" }}
        >
          {/* Keyed by section: within a section only what changes animates. */}
          <div key={sectionKey} className="h-full" style={{ zoom: SCENE_ZOOM[sectionKey] }}>
            <Scene section={step.section} {...sceneProps} />
          </div>
        </main>

        <footer className="relative h-16 shrink-0 border-t border-stone-200 bg-white">
          {captionVisible && step.caption && (
            <p key={pos.index} className="demo-fade flex h-full items-center justify-center px-24 text-center text-2xl text-stone-800">
              {step.caption}
            </p>
          )}
          <span className="absolute bottom-2 right-4 text-xs tabular-nums text-stone-400">
            {pos.index + 1} / {steps.length}
          </span>
        </footer>
      </div>
    </div>
  );
}

function Scene({ section, ...props }: SceneProps & { section: Section | null }) {
  switch (section) {
    case "Charter":
      return <CharterScene {...props} />;
    case "Document":
      return <DocumentScene {...props} />;
    case "Ledger":
      return <LedgerScene {...props} />;
    case "Checkpoints":
      return <CheckpointsScene {...props} />;
    case "Progress":
      return <ProgressScene />;
    case "Teacher":
      return <TeacherScene />;
    default:
      return <CloseScene />;
  }
}

function TopBar({ section, viewer }: { section: Section | null; viewer?: number | "teacher" }) {
  const current = section ? SECTIONS.indexOf(section) : SECTIONS.length;
  const viewerName = viewer === "teacher" ? "Teacher" : members.find((m) => m.id === viewer)?.name;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-10">
      <div className="flex items-center gap-6">
        <span className="text-xl font-semibold text-accent">Ledgitt</span>
        <ol className="flex items-center gap-1 text-base">
          {SECTIONS.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              {i > 0 && <span className="px-1 text-stone-300" aria-hidden>·</span>}
              <span
                className={`rounded-full px-3 py-1 transition-colors duration-300 ${
                  i === current
                    ? "bg-accent font-semibold text-white"
                    : i < current
                      ? "text-stone-700"
                      : "text-stone-400"
                }`}
                aria-current={i === current ? "step" : undefined}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {viewerName && (
        <span key={viewerName} className="demo-fade rounded-full border border-stone-300 bg-stone-50 px-4 py-1.5 text-base">
          Viewing as: <span className="font-semibold">{viewerName}</span>
        </span>
      )}
    </header>
  );
}

// Scales the fixed 1280x720 stage to fit the window, so it looks the same on a
// laptop and a projector.
function useStageScale(): number {
  const compute = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}
