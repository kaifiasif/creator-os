import type { RunView } from '@/api/types';
import { formatDate, formatPercent, formatRelative, plural } from '@/lib/format';
import { REJECT_REASON } from '@/lib/labels';
import { DECISION_KIND, RECHECK_STATUS } from '@/lib/labels';
import type { Decision } from '../lib/types';

function Entry({ d }: { d: Decision }) {
  return (
    <li className="grid gap-1 py-3 text-sm first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{DECISION_KIND[d.decision]}</span>
        <time dateTime={d.decided_at} title={formatDate(d.decided_at)} className="text-xs text-muted-foreground">
          {formatRelative(d.decided_at)}
        </time>
      </div>
      <div className="grid gap-0.5 text-muted-foreground">
        {d.reject_reason && <p>{REJECT_REASON[d.reject_reason]}.</p>}
        {d.reject_note && <p>{d.reject_note}</p>}
        {d.edit_ratio !== null && d.decision !== 'reject' && <p>Changed {formatPercent(d.edit_ratio)} of the text{d.claim_set_changed ? ' and the claims it cites' : ''}.</p>}
        {d.assist === 'reviewer' && <p>Started from the Reviewer's version.</p>}
        {d.recheck_status && <p>Re-check: {RECHECK_STATUS[d.recheck_status].toLowerCase()}.</p>}
        {d.overrides.length > 0 && (
          <>
            <p>Kept {plural(d.overrides.length, 'flagged sentence')} with a reason:</p>
            <ul className="list-disc pl-4">
              {d.overrides.map((o, i) => (
                <li key={i}>{o.reason}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  );
}

export function HistoryPanel({ decisions }: { decisions: RunView['decisions'] }) {
  if (!decisions.length) return <p className="text-sm text-muted-foreground">No decisions yet. Accept, edit or reject the draft and it shows up here.</p>;
  const newest = [...decisions].reverse();
  return (
    <ol className="grid divide-y">
      {newest.map((d) => (
        <Entry key={d.id} d={d} />
      ))}
    </ol>
  );
}
