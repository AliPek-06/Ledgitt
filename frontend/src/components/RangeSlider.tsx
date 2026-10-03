import { useRef, type KeyboardEvent, type PointerEvent } from "react";

const STEP = 0.01;
const MIN_GAP = 0.01;

type Handle = "start" | "end";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Round to whole percent without float noise (0.15, not 0.15000000000000002).
const round = (v: number) => Math.round(v * 100) / 100;

interface Props {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  checkpoints?: number[];
  label: string;
}

// Two-handle range over the project timeline, 0..1 in steps of 1%.
// Drag either handle, click the track to move the nearest one, or use the
// arrow keys on a focused handle (Shift for 5%).
export default function RangeSlider({ start, end, onChange, checkpoints = [], label }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Handle | null>(null);

  function move(handle: Handle, value: number) {
    const v = round(value);
    if (handle === "start") onChange(clamp(v, 0, end - MIN_GAP), end);
    else onChange(start, clamp(v, start + MIN_GAP, 1));
  }

  function pctFromPointer(e: PointerEvent): number {
    const rect = trackRef.current!.getBoundingClientRect();
    return clamp((e.clientX - rect.left) / rect.width, 0, 1);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const pct = pctFromPointer(e);
    const target = (e.target as HTMLElement).dataset.handle as Handle | undefined;
    const handle = target ?? (Math.abs(pct - start) <= Math.abs(pct - end) && pct <= end ? "start" : "end");
    dragging.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(handle, pct);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current) move(dragging.current, pctFromPointer(e));
  }

  function onPointerUp() {
    dragging.current = null;
  }

  function onKeyDown(handle: Handle, e: KeyboardEvent) {
    const step = e.shiftKey ? STEP * 5 : STEP;
    const current = handle === "start" ? start : end;
    const next: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowDown: current - step,
      ArrowRight: current + step,
      ArrowUp: current + step,
      Home: 0,
      End: 1,
    };
    if (e.key in next) {
      e.preventDefault();
      move(handle, next[e.key]);
    }
  }

  const thumb = (handle: Handle, value: number) => (
    <div
      data-handle={handle}
      role="slider"
      tabIndex={0}
      aria-label={`${label} ${handle}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onKeyDown={(e) => onKeyDown(handle, e)}
      className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-accent bg-white shadow focus:outline-none focus:ring-4 focus:ring-accent/25 active:cursor-grabbing"
      style={{ left: `${value * 100}%` }}
    />
  );

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-8 cursor-pointer touch-none select-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-stone-200" />
      {checkpoints.map((c) => (
        <div
          key={c}
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-stone-400"
          style={{ left: `${c * 100}%` }}
        />
      ))}
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
      />
      {thumb("start", start)}
      {thumb("end", end)}
    </div>
  );
}
