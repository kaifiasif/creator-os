import { useSyncExternalStore } from 'react';

/** App-wide overlays any screen can open: the capture sheet, the command menu, the shortcut list. */
export type Overlay = 'capture' | 'command' | 'shortcuts' | null;

let current: Overlay = null;
const listeners = new Set<() => void>();

export function openOverlay(overlay: Overlay): void {
  current = overlay;
  for (const listener of listeners) listener();
}

export const closeOverlay = () => openOverlay(null);

export function useOverlay(): Overlay {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
