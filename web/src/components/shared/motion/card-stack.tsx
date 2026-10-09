import { ChevronRightIcon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface StackItem {
  id: string;
  label: string;
  content: ReactNode;
  onOpen?: () => void;
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const SHOWN = 4;
const FLICK_PX = 90;

/** Where a card sits by depth: each one further back is lower, smaller and fanned a little. */
function depthStyle(depth: number, dx: number): CSSProperties {
  if (depth === 0) return { transform: `translate(${dx}px, 0) rotate(${dx / 18}deg)`, zIndex: SHOWN + 1 };
  const fan = depth % 2 ? 2.2 : -2.2;
  return {
    transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05}) rotate(${fan * depth * 0.6}deg)`,
    zIndex: SHOWN - depth,
    opacity: depth >= SHOWN ? 0 : 1,
  };
}

/**
 * A pile of cards. In "flick" mode you drag the top card aside (or press Next) to send it to the back,
 * and click it to open it. In "shuffle" mode the pile turns over on its own every few seconds, pausing
 * while the pointer or focus is on it. Reduced motion keeps the pile still; Next still works.
 */
export function CardStack({ items, mode, className, height = 168 }: { items: StackItem[]; mode: 'flick' | 'shuffle'; className?: string; height?: number }) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  useEffect(() => setOrder(items.map((_, i) => i)), [items]);

  const next = () => {
    if (items.length < 2) return;
    setLeaving(true);
    setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setLeaving(false);
      setDx(0);
    }, reduced() ? 0 : 320);
  };

  useEffect(() => {
    if (mode !== 'shuffle' || paused || items.length < 2 || reduced()) return;
    const t = setInterval(next, 3600);
    return () => clearInterval(t);
  });

  const onDown = (e: PointerEvent) => {
    if (mode !== 'flick') return;
    drag.current = { x: e.clientX, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > 4) drag.current.moved = true;
    setDx(d);
  };
  const onUp = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (Math.abs(dx) > FLICK_PX) next();
    else {
      setDx(0);
      if (!moved) items[order[0]]?.onOpen?.();
    }
  };

  if (items.length === 0) return null;
  const front = items[order[0]];

  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative" style={{ height: height + 30 }} aria-roledescription="card stack">
        {order.map((itemIndex, depth) => {
          const item = items[itemIndex];
          const isFront = depth === 0;
          return (
            <div
              key={item.id}
              aria-hidden={!isFront}
              className={cn(
                'stack-card absolute inset-x-0 top-0 overflow-hidden rounded-xl border bg-card p-5 shadow-sm select-none',
                isFront && mode === 'flick' && 'cursor-grab touch-pan-y active:cursor-grabbing',
                isFront && dx === 0 && 'shadow-md',
                isFront && leaving && 'pointer-events-none',
              )}
              style={{
                height,
                ...(isFront && leaving ? { transform: `translate(${dx > 0 ? 120 : mode === 'flick' ? -120 : 0}%, ${mode === 'shuffle' ? 40 : 0}px) rotate(${mode === 'flick' ? (dx >= 0 ? 12 : -12) : 0}deg)`, opacity: 0, zIndex: SHOWN + 1 } : depthStyle(depth, isFront ? dx : 0)),
                transition: isFront && drag.current ? 'none' : undefined,
              }}
              onPointerDown={isFront ? onDown : undefined}
              onPointerMove={isFront ? onMove : undefined}
              onPointerUp={isFront ? onUp : undefined}
              onPointerCancel={isFront ? () => setDx(0) : undefined}
            >
              {item.content}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {order[0] + 1} of {items.length}
          <span className="sr-only">: {front.label}</span>
        </span>
        <div className="flex gap-1">
          {front.onOpen && (
            <Button variant="ghost" size="sm" onClick={front.onOpen}>
              Open
            </Button>
          )}
          {items.length > 1 && (
            <Button variant="outline" size="sm" onClick={next}>
              Next <ChevronRightIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
