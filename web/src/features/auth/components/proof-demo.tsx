import { CheckIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { TONE_DOT } from '@/components/shared/tone';
import type { Tone } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Seconds into the sequence, as an animation delay. */
const at = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

function Note({ tone, when, children }: { tone: Tone; when: number; children: ReactNode }) {
  return (
    <p className="motion-rise mt-2 flex items-center gap-2 text-sm text-muted-foreground" style={at(when)}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
      {children}
    </p>
  );
}

/**
 * The log-in page's one moving picture: a draft written from a voice memo, checked sentence by sentence
 * the way the review screen marks it (same colours, same underlines), then fixed by the Reviewer.
 * It plays once, and shows its last frame straight away when motion is reduced.
 */
export function ProofDemo() {
  return (
    <figure className="flex w-full max-w-2xl flex-col gap-10 [--cover:var(--muted)]">
      <blockquote className="motion-rise border-l-2 pl-4 text-muted-foreground" style={at(0.2)}>
        <p className="text-sm">From your voice memo</p>
        <p className="mt-1 leading-relaxed">“…the thing I keep coming back to is small pull requests. They get reviewed the same day. The big ones just sit there.”</p>
      </blockquote>

      <div className="flex flex-col gap-7 text-2xl leading-snug font-medium tracking-tight text-balance xl:text-3xl">
        <div>
          <p className="motion-rise" style={at(1)}>
            Small pull requests get reviewed the same day.
            <CheckIcon aria-hidden className="motion-pop ml-2 inline size-6 align-[-3px] text-supported" style={at(1.7)} />
          </p>
          <Note tone="supported" when={1.9}>
            Backed by what you said
          </Note>
        </div>

        <div>
          <p className="motion-rise" style={at(2.6)}>
            <span className="proof-strike text-foreground [--strike:var(--unsupported)]" style={at(6.2)}>
              <span className="proof-ink text-foreground [--ink:var(--unsupported)]" style={at(3.2)}>
                They cut my review time by 73 percent.
              </span>
            </span>
          </p>
          <Note tone="unsupported" when={3.7}>
            Nothing you said backs this number
          </Note>
        </div>

        <div>
          <p className="motion-rise" style={at(4.3)}>
            <span className="proof-ink-wavy" style={at(4.9)}>
              Shipping small means being wrong in smaller pieces.
            </span>
          </p>
          <Note tone="repeat" when={5.5}>
            Close to your post from March 3
          </Note>
        </div>
      </div>

      <figcaption className="motion-rise flex items-start gap-3 border-t pt-6 text-sm text-muted-foreground" style={at(6.8)}>
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-supported/15 text-supported">
          <CheckIcon aria-hidden className="size-3.5" />
        </span>
        <span>
          The Reviewer struck the invented number. Every draft is checked against what you said and what you have already posted, and nothing goes out until you accept it.
        </span>
      </figcaption>
    </figure>
  );
}
