// A global "refresh now" signal. Every usePolling hook listens for it, so a demo
// change (time, seed, reset) updates every screen at once instead of within 3s.
const REFRESH_EVENT = "ledger:refresh";

export function refreshAll(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function onRefreshAll(listener: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, listener);
  return () => window.removeEventListener(REFRESH_EVENT, listener);
}
