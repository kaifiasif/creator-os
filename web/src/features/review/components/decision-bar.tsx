import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { plural } from '@/lib/format';

interface DecisionBarProps {
  editing: boolean;
  busy: boolean;
  canAccept: boolean;
  canEdit: boolean;
  canReject: boolean;
  blocking: number;
  checksFailed: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onReject: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const Key = ({ children }: { children: ReactNode }) => <Kbd className="hidden bg-transparent text-current opacity-70 sm:inline-flex">{children}</Kbd>;

/** Sticky at the bottom of the draft: the three decisions, or save and cancel while editing. */
export function DecisionBar(p: DecisionBarProps) {
  const hint = p.editing
    ? 'Every check runs again on your final text.'
    : p.checksFailed
      ? 'The checks could not run, so this draft can only be rejected.'
      : p.blocking
        ? `${plural(p.blocking, 'flagged sentence')} will need an edit, a removal or a reason when you accept.`
        : 'Read it as you would before posting.';

  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border md:shadow-sm">
      <p className="min-w-0 flex-1 basis-56 text-sm text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        {p.editing ? (
          <>
            <Button variant="ghost" onClick={p.onCancel} disabled={p.busy}>
              Cancel
            </Button>
            <Button onClick={p.onSave} disabled={p.busy} data-testid="save-accept">
              {p.busy ? <Spinner /> : <CheckIcon />} Save and accept <Key>{MOD} Enter</Key>
            </Button>
          </>
        ) : (
          <>
            {p.canReject && (
              <Button variant="outline" onClick={p.onReject} disabled={p.busy}>
                <XIcon /> Reject <Key>R</Key>
              </Button>
            )}
            {p.canEdit && (
              <Button variant="outline" onClick={p.onEdit} disabled={p.busy}>
                <PencilIcon /> Edit <Key>E</Key>
              </Button>
            )}
            {p.checksFailed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="rounded-md">
                    <Button disabled>
                      <CheckIcon /> Accept
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Run the checks again before accepting.</TooltipContent>
              </Tooltip>
            ) : (
              p.canAccept && (
                <Button onClick={p.onAccept} disabled={p.busy} data-testid="accept">
                  {p.busy ? <Spinner /> : <CheckIcon />} Accept <Key>A</Key>
                </Button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
