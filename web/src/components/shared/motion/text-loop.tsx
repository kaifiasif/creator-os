import { useEffect, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Shows one of `words` at a time, sliding the next one up into place every `interval` ms.
 * Screen readers hear the whole list once instead of a changing word; reduced motion keeps the first.
 */
export function TextLoop({ words, interval = 2400, className }: { words: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (words.length < 2 || reduced()) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <>
      <span aria-hidden className={`text-loop ${className ?? ''}`}>
        <span key={index}>{words[index]}</span>
      </span>
      <span className="sr-only">{words.join(', ')}</span>
    </>
  );
}
