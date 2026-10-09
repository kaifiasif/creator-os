import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Blot, the Creator OS mascot: a small plush ink drop, drawn as a die-cut sticker. Each pose holds the
 * tool for one part of the job (a pencil to write, a magnifier to check, a stamp to approve), so it is
 * only ever shown where that part is happening. Pure SVG, coloured from the theme in index.css.
 */
export type MascotPose = 'pencil' | 'magnifier' | 'stamp' | 'sleep' | 'wave' | 'cheer';

const LABEL: Record<MascotPose, string> = {
  pencil: 'Blot, the Creator OS ink drop, holding a pencil',
  magnifier: 'Blot, the Creator OS ink drop, looking through a magnifier',
  stamp: 'Blot, the Creator OS ink drop, holding an approval stamp',
  sleep: 'Blot, the Creator OS ink drop, asleep in a nightcap',
  wave: 'Blot, the Creator OS ink drop, waving',
  cheer: 'Blot, the Creator OS ink drop, cheering',
};

const BODY = 'M61 13 C 66 32, 97 50, 97 77 C 97 99, 81 111, 60 111 C 39 111, 23 99, 23 77 C 23 50, 55 32, 61 13 Z';

function Eyes({ pose }: { pose: MascotPose }) {
  if (pose === 'sleep') {
    return (
      <g className="m-line" strokeWidth={2.6}>
        <path d="M44 72 q 5 4 10 0" />
        <path d="M66 72 q 5 4 10 0" />
      </g>
    );
  }
  // looking through the lens, the eyes turn toward it
  const look = pose === 'magnifier' ? 1.6 : 0;
  return (
    <g>
      <ellipse className="m-face" cx={49} cy={71} rx={5.2} ry={6.2} />
      <ellipse className="m-face" cx={71} cy={71} rx={5.2} ry={6.2} />
      <circle className="m-ink" cx={49.6 + look} cy={72} r={3} />
      <circle className="m-ink" cx={70.4 + look} cy={72} r={3} />
      <circle className="m-glint" cx={51 + look} cy={70.2} r={1.1} />
      <circle className="m-glint" cx={71.8 + look} cy={70.2} r={1.1} />
    </g>
  );
}

function Face({ pose }: { pose: MascotPose }) {
  const open = pose === 'cheer' || pose === 'wave';
  return (
    <g>
      <Eyes pose={pose} />
      <ellipse className="m-cheek" cx={40} cy={82} rx={5} ry={3} />
      <ellipse className="m-cheek" cx={80} cy={82} rx={5} ry={3} />
      {open ? <path className="m-mouth" d="M54 82 q 6 8 12 0 z" /> : <path className="m-line" strokeWidth={2.4} d="M55 83 q 5 4.5 10 0" />}
    </g>
  );
}

/** Arms are soft nubs; a raised one carries the pose's prop. */
function Arms({ pose }: { pose: MascotPose }) {
  const leftUp = pose === 'cheer';
  const rightUp = pose === 'wave' || pose === 'cheer' || pose === 'stamp';
  return (
    <g className="m-ink">
      {leftUp ? <ellipse cx={20} cy={66} rx={6.5} ry={11} transform="rotate(35 20 66)" /> : <ellipse cx={22} cy={88} rx={6.5} ry={10} transform="rotate(25 22 88)" />}
      {rightUp ? <ellipse cx={100} cy={66} rx={6.5} ry={11} transform="rotate(-35 100 66)" /> : <ellipse cx={98} cy={88} rx={6.5} ry={10} transform="rotate(-25 98 88)" />}
    </g>
  );
}

function Prop({ pose }: { pose: MascotPose }) {
  switch (pose) {
    case 'pencil':
      return (
        <g transform="rotate(-38 104 82)">
          <rect className="m-ember" x={98} y={52} width={11} height={38} rx={2} />
          <rect className="m-stone" x={98} y={48} width={11} height={7} rx={2} />
          <path className="m-face" d="M98 90 h11 l-5.5 11 z" />
          <path className="m-ink" d="M101.6 97.2 h3.8 l-1.9 3.8 z" />
        </g>
      );
    case 'magnifier':
      return (
        <g>
          <rect className="m-stone" x={95} y={84} width={7} height={22} rx={3.5} transform="rotate(-40 98 95)" />
          <circle className="m-lens" cx={92} cy={66} r={14} />
          <circle className="m-ring" cx={92} cy={66} r={14} strokeWidth={5} />
          <path className="m-glint" d="M84 60 a 9 9 0 0 1 7 -5 l 0.6 2.4 a 7 7 0 0 0 -5.2 3.8 z" />
        </g>
      );
    case 'stamp':
      return (
        <g>
          <circle className="m-ember" cx={106} cy={36} r={7} />
          <rect className="m-ember" x={103} y={40} width={6} height={12} />
          <rect className="m-stone" x={96} y={50} width={20} height={8} rx={2} />
          <rect className="m-ember" x={96} y={56} width={20} height={3} rx={1} />
        </g>
      );
    case 'sleep':
      return (
        <g>
          <path className="m-ember" d="M40 40 C 50 18, 70 6, 90 18 C 84 22, 80 30, 82 38 C 68 30, 54 32, 40 40 Z" />
          <path className="m-face" d="M38 42 C 52 30, 72 30, 86 40 l -2 6 C 70 37, 54 37, 41 48 z" />
          <circle className="m-face" cx={92} cy={22} r={6} />
          <text className="m-zz" x={98} y={52} fontSize={13}>z</text>
          <text className="m-zz" x={106} y={40} fontSize={9}>z</text>
        </g>
      );
    default:
      return null;
  }
}

function Figure({ pose }: { pose: MascotPose }) {
  return (
    <>
      <ellipse className="m-ink" cx={47} cy={109} rx={9} ry={5.5} />
      <ellipse className="m-ink" cx={73} cy={109} rx={9} ry={5.5} />
      <Arms pose={pose} />
      <path className="m-ink" d={BODY} />
      <path className="m-sheen" d="M36 64 C 38 50, 48 40, 56 34 C 50 46, 44 56, 42 70 Z" />
      <path className="m-seam" d={BODY} transform="translate(6 7.6) scale(0.9)" />
      <Face pose={pose} />
      <Prop pose={pose} />
    </>
  );
}

/** One sticker. Decorative by default; pass `label` to have it announced. */
export function Mascot({ pose, className, label, children }: { pose: MascotPose; className?: string; label?: boolean; children?: ReactNode }) {
  return (
    <svg
      viewBox="0 0 124 124"
      className={cn('mascot', className)}
      {...(label ? { role: 'img', 'aria-label': LABEL[pose] } : { 'aria-hidden': true })}
    >
      <g transform="translate(2 4)">
        {/* the die-cut edge: the same drawing, fattened and filled with the sticker's paper colour */}
        <g className="mascot-cut">
          <Figure pose={pose} />
        </g>
        <Figure pose={pose} />
        {children}
      </g>
    </svg>
  );
}
