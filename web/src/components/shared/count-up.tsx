import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A headline number that counts up to its value when it first appears or changes. Text like "73%"
 * or "1,204" keeps its suffix and separators; anything without a number is shown as is.
 * Screen readers get the final value only.
 */
export function CountUp({ value, duration = 700 }: { value: string | number; duration?: number }) {
  const text = String(value);
  const match = /-?\d[\d,]*(\.\d+)?/.exec(text);
  const target = match ? Number(match[0].replace(/,/g, '')) : null;
  const decimals = match?.[1] ? match[1].length - 1 : 0;
  const [shown, setShown] = useState(() => (target === null || reduced() ? target : 0));
  const from = useRef(0);

  useEffect(() => {
    if (target === null) return;
    if (reduced()) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(origin + (target - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  if (!match || target === null || shown === null) return <>{text}</>;
  const formatted = shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: match[0].includes(',') });
  return (
    <>
      <span aria-hidden>{text.slice(0, match.index) + formatted + text.slice(match.index + match[0].length)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
