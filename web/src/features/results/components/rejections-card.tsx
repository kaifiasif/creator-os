import type { AcceptanceOpen, RejectReason } from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { REJECT_REASON } from '@/lib/labels';
import { plural } from '@/lib/format';
import { MetricList } from './metric-list';

const reasonLabel = (key: string) => REJECT_REASON[key as RejectReason] ?? key;

export function RejectionsCard({ rejections }: { rejections: AcceptanceOpen['rejections'] }) {
  const reasons = Object.entries(rejections.reasons).sort(([, a], [, b]) => b - a);
  const top = Math.max(1, ...reasons.map(([, n]) => n));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rejections by reason</CardTitle>
        <CardDescription>{rejections.total ? `${plural(rejections.total, 'draft')} rejected at first look.` : 'No drafts rejected yet.'}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {reasons.length > 0 && (
          <ul className="grid gap-3">
            {reasons.map(([reason, count]) => (
              <li key={reason} className="grid gap-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{reasonLabel(reason)}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-chart-2" style={{ width: `${(count / top) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <MetricList
          rows={[
            { label: 'Fixed and accepted later', value: rejections.fixed },
            { label: 'Abandoned', value: rejections.abandoned },
            { label: 'Still rejected', value: rejections.pending },
          ]}
        />
      </CardContent>
    </Card>
  );
}
