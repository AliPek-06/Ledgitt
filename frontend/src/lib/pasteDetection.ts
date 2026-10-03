// PASTE DETECTION rules from docs/RULES.md. Pure functions, no editor or network.

export const PASTE_MIN_CHARS = 200;
export const BURST_MIN_CHARS = 300;
export const BURST_WINDOW_MS = 10_000;
export const PREVIEW_CHARS = 120;

// Lowercase with collapsed whitespace.
export function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isLargePaste(text: string): boolean {
  return text.length >= PASTE_MIN_CHARS;
}

// is_internal: the normalised pasted text already exists in the document before
// the paste. Text cut from this document moments ago also counts, so moving a
// paragraph with cut + paste isn't flagged.
export function isInternalPaste(pasted: string, docTextBefore: string, recentCuts: string[] = []): boolean {
  const needle = normalise(pasted);
  if (needle === "") return true;
  return normalise(docTextBefore).includes(needle) || recentCuts.some((cut) => normalise(cut).includes(needle));
}

export interface Burst {
  char_count: number;
  preview: string;
}

// Characters inserted by non-paste edits in a sliding 10-second window.
// add() returns a Burst (and resets the window) once the window reaches 300.
export class BurstTracker {
  private inserts: { at: number; text: string }[] = [];

  add(at: number, text: string): Burst | null {
    if (text.length === 0) return null;
    this.inserts = this.inserts.filter((i) => at - i.at < BURST_WINDOW_MS);
    this.inserts.push({ at, text });
    const char_count = this.inserts.reduce((sum, i) => sum + i.text.length, 0);
    if (char_count < BURST_MIN_CHARS) return null;
    const preview = this.inserts.map((i) => i.text).join("").slice(0, PREVIEW_CHARS);
    this.inserts = [];
    return { char_count, preview };
  }
}
