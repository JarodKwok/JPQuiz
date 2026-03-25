export const DATA_UPDATED_EVENT = "jpquiz:data-updated";

export function emitDataUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT));
}

export function subscribeDataUpdated(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(DATA_UPDATED_EVENT, listener);
  return () => window.removeEventListener(DATA_UPDATED_EVENT, listener);
}
