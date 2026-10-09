import { useEffect, useRef } from 'react';

const LEADER_WINDOW_MS = 900;
let leaderUntil = 0;

/** Starts a two-key sequence ("G then I"): for a moment, only `leader` shortcuts respond. */
export const startLeader = () => {
  leaderUntil = Date.now() + LEADER_WINDOW_MS;
};

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
};

interface HotkeyOptions {
  /** Require ⌘/Ctrl. Works even while typing. */
  mod?: boolean;
  /** Only fire as the second key of a sequence started with startLeader(). */
  leader?: boolean;
  enabled?: boolean;
}

/**
 * Single-key shortcuts that stay out of the way: ignored while typing, while a dialog is open,
 * when a focused control already handled the key,
 * or with a modifier held.
 */
export function useHotkey(key: string, handler: (event: KeyboardEvent) => void, options: HotkeyOptions = {}) {
  const { mod = false, leader = false, enabled = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase() && event.key !== key) return;
      if (mod) {
        if (event.metaKey || event.ctrlKey) handlerRef.current(event);
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || document.querySelector('[role=dialog]')) return;
      const leaderActive = Date.now() < leaderUntil;
      if (leader !== leaderActive) return;
      if (leader) leaderUntil = 0;
      handlerRef.current(event);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [key, mod, leader, enabled]);
}
