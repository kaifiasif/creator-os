import { ShieldAlertIcon } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { DraftSentence } from '@/api/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PROBLEM } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { hasChecks, PROBLEM_UNDERLINE, problemReason, problemsOf } from '../lib/checks';

const LINE_STYLE = { unsupported: 'decoration-solid', partial: 'decoration-dashed', repeat: 'decoration-wavy' } as const;

/** One selectable sentence. Problems are underlined in their proof colour, with the reason on hover. */
export function Sentence({ sentence, selected, enforce, onSelect }: { sentence: DraftSentence; selected: boolean; enforce: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const checks = hasChecks(sentence.checks) ? sentence.checks : null;
  const problem = problemsOf(checks)[0] ?? null;
  const blocking = enforce && sentence.blocking;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSelect();
  };

  const body = (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-testid="sentence"
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'pencil-select cursor-pointer rounded-sm box-decoration-clone transition-colors outline-none hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        problem && ['proof-arrive underline decoration-2 underline-offset-[5px]', PROBLEM_UNDERLINE[problem], LINE_STYLE[problem]],
      )}
    >
      {sentence.text}
      {blocking && (
        <>
          <ShieldAlertIcon aria-hidden className="ml-1 inline size-3.5 align-[-2px] text-unsupported" />
          <span className="sr-only"> (blocks accepting)</span>
        </>
      )}
    </span>
  );

  if (!problem || !checks) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <span className="font-medium">{PROBLEM[problem].label}.</span> {problemReason(checks)}
      </TooltipContent>
    </Tooltip>
  );
}
