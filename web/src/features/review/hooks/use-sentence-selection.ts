import { useState } from 'react';
import type { DraftSentence } from '@/api/types';
import { useHotkey } from '@/hooks/use-hotkey';

/** Which sentence is open in the detail panel. J and K move through the draft, Escape closes it. */
export function useSentenceSelection(sentences: DraftSentence[], enabled: boolean) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sentences.find((s) => s.id === selectedId) ?? null;

  const step = (delta: number) => {
    if (!sentences.length) return;
    const at = sentences.findIndex((s) => s.id === selectedId);
    const next = at < 0 ? (delta > 0 ? 0 : sentences.length - 1) : Math.max(0, Math.min(sentences.length - 1, at + delta));
    setSelectedId(sentences[next].id);
  };

  useHotkey('j', () => step(1), { enabled });
  useHotkey('k', () => step(-1), { enabled });
  useHotkey('Escape', () => setSelectedId(null), { enabled: enabled && selectedId !== null });

  return {
    selected,
    toggle: (id: string) => setSelectedId((current) => (current === id ? null : id)),
    clear: () => setSelectedId(null),
  };
}
