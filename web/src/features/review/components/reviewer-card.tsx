import { WandSparklesIcon } from 'lucide-react';
import type { ReviewOutput } from '@/api/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { PROBLEM } from '@/lib/labels';
import { ISSUE_ACTION } from '@/lib/labels';

function Verification({ output }: { output: ReviewOutput }) {
  const v = output.verification;
  if (v.gate_failed) return <StatusBadge status={{ label: 'Could not check its version', tone: 'unsupported' }} />;
  if (!v.blocking) return <StatusBadge status={{ label: 'Its version passes every check', tone: 'supported' }} />;
  return <StatusBadge status={{ label: `${plural(v.blocking, 'flag')} left in its version`, tone: 'partial' }} />;
}

/** The Reviewer's summary, its issues per sentence, and the server's check of its revised version. */
export function ReviewerCard({ output, sentenceText, onUse }: { output: ReviewOutput; sentenceText: Map<string, string>; onUse?: (posts: string[]) => void }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm">{output.summary}</p>
      {output.issues.length > 0 && (
        <ul className="grid gap-2">
          {output.issues.map((issue, i) => (
            <li key={`${issue.sentence_id}-${i}`} className="grid gap-1.5 rounded-md bg-muted/50 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={PROBLEM[issue.problem] ?? { label: issue.problem, tone: 'neutral' }} />
                <span className="text-xs text-muted-foreground">{ISSUE_ACTION[issue.action]}</span>
              </div>
              <p className={issue.action === 'replace' || issue.action === 'remove' ? 'text-muted-foreground line-through' : ''}>{sentenceText.get(issue.sentence_id) ?? 'A sentence that is no longer in the draft.'}</p>
              {issue.replacement && <p>{issue.replacement}</p>}
              {issue.note && <p className="text-xs text-muted-foreground">{issue.note}</p>}
            </li>
          ))}
        </ul>
      )}
      {output.changed && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Verification output={output} />
          {onUse && (
            <Button size="sm" variant="outline" onClick={() => onUse(output.revised_posts)} data-testid="use-reviewer">
              <WandSparklesIcon /> Use the Reviewer's version
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
