import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Mascot, type MascotPose } from './mascot';

/** Where each sticker sits in the pile, as percentages of the pile, with its tilt and arrival time. */
const PILE: { pose: MascotPose; left: number; top: number; size: number; tilt: number; at: number }[] = [
  { pose: 'pencil', left: 2, top: 4, size: 44, tilt: -10, at: 0.1 },
  { pose: 'magnifier', left: 48, top: 0, size: 46, tilt: 8, at: 0.25 },
  { pose: 'sleep', left: 22, top: 30, size: 52, tilt: -3, at: 0.4 },
  { pose: 'stamp', left: 0, top: 54, size: 44, tilt: 7, at: 0.55 },
  { pose: 'wave', left: 52, top: 52, size: 46, tilt: -8, at: 0.7 },
];

/** Blot in every pose, slapped down one sticker at a time like a handful from a sheet. */
export function StickerPile({ className }: { className?: string }) {
  return (
    <div role="img" aria-label="A pile of Blot stickers: writing, checking, asleep, stamping and waving" className={cn('relative aspect-square w-full', className)}>
      {PILE.map((s) => (
        <div
          key={s.pose}
          className="sticker sticker-in absolute"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}%`, '--tilt': `${s.tilt}deg`, animationDelay: `${s.at}s` } as CSSProperties}
        >
          <Mascot pose={s.pose} className="size-full" />
        </div>
      ))}
    </div>
  );
}
