import { AlertTriangleIcon } from 'lucide-react';
import type { RehearsalResult } from '@/api/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatPercent, plural } from '@/lib/format';
import { REHEARSAL_ENGINE } from '@/lib/labels';
import { DetailSection } from './detail-section';
import { ReportText } from './report-text';

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="grid gap-0.5 rounded-md border p-2 text-center">
    <span className="text-lg font-semibold tabular-nums">{value}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

export function RehearsalResults({ result }: { result: RehearsalResult }) {
  const reacted = result.sentences.filter((s) => s.mentions > 0).sort((a, b) => b.pushback - a.pushback || b.mentions - a.mentions);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={REHEARSAL_ENGINE[result.engine]} />
        <span className="text-xs text-muted-foreground">
          {plural(result.agents, 'follower')}, {plural(result.rounds ?? 0, 'round')}
        </span>
      </div>
      {result.engine === 'swarm-offline' && (
        <Alert>
          <AlertTriangleIcon />
          <AlertDescription>This is a rule-based estimate, not simulated people. Add a free model key for a real rehearsal.</AlertDescription>
        </Alert>
      )}
      {!result.draft_seeded && (
        <Alert>
          <AlertTriangleIcon />
          <AlertDescription>MiroFish reworded your draft before posting it, so these reactions are to its version.</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Likes" value={result.counts.likes} />
        <Stat label="Reposts" value={result.counts.reposts} />
        <Stat label="Replies" value={result.counts.replies + result.counts.quotes} />
        <Stat label="Pushback" value={formatPercent(result.pushback_share)} />
      </div>
      <p className="text-xs text-muted-foreground">Pushback is spotted from wording such as "source?" or "wrong", not judged by a model.</p>

      <DetailSection title="Sentences people reacted to" tone={reacted.some((s) => s.pushback) ? 'partial' : undefined}>
        {reacted.length ? (
          <ul className="grid gap-2">
            {reacted.map((s) => (
              <li key={s.id ?? s.text}>
                <p className="font-serif text-foreground">{s.text}</p>
                <p className="text-xs">
                  {plural(s.mentions, 'reaction')}
                  {s.pushback > 0 && `, ${s.pushback} pushing back`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No reaction pointed at a specific sentence.</p>
        )}
      </DetailSection>

      <DetailSection title="Replies">
        {result.replies.length ? (
          <ul className="grid gap-2.5">
            {result.replies.map((r, i) => (
              <li key={`${r.agent_id}-${i}`} className="grid gap-0.5">
                <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {r.agent_name}
                  {r.stance === 'pushback' && <StatusBadge status={{ label: 'Pushback', tone: 'partial' }} />}
                </span>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nobody replied to the post.</p>
        )}
      </DetailSection>

      {result.report?.markdown && (
        <DetailSection title="Prediction report">
          <div className="max-h-96 overflow-auto rounded-md border p-3">
            <ReportText markdown={result.report.markdown} />
          </div>
        </DetailSection>
      )}
      {result.report_error && <p className="text-sm text-muted-foreground">The report could not be written ({result.report_error}). The results above are complete.</p>}
    </div>
  );
}
