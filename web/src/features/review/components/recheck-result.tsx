import { PencilIcon, RotateCwIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { isBlockingChecks, problemReason } from '../lib/checks';
import type { Decision } from '../lib/types';
import { FinalPosts } from './final-posts';

interface RecheckResultProps {
  decision: Decision;
  busy: boolean;
  onEdit: () => void;
  onRecheck: (keep: { sentence_text: string; reason: string }[]) => void;
}

/** The final text did not pass: list what is flagged, and let the creator edit or keep with reasons. */
export function RecheckResult({ decision, busy, onEdit, onRecheck }: RecheckResultProps) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const recheck = decision.recheck;
  const failed = decision.recheck_status === 'gate_failed';
  const flagged = (recheck?.sentences ?? []).filter((s) => s.checks && isBlockingChecks(s.checks) && !s.overridden);
  const channel = (recheck?.channel ?? []).filter((c) => !c.ok);
  const allReasons = flagged.every((s) => reasons[s.key]?.trim());
  const keep = flagged.map((s) => ({ sentence_text: s.text, reason: reasons[s.key]?.trim() ?? '' }));

  return (
    <div className="grid gap-4">
      <FinalPosts posts={decision.final_posts ?? []} />
      {failed && <p className="text-sm text-muted-foreground">{recheck?.error ?? 'The checks stopped before finishing.'} Run them again, or edit the text.</p>}
      {channel.map((c) => (
        <p key={c.position} className="rounded-md border border-unsupported/40 px-3 py-2 text-sm">
          <span className="font-medium text-unsupported">Post {c.position} breaks an X rule.</span> {c.issues.join(' ')} Edit the text to fix it.
        </p>
      ))}
      {flagged.length > 0 && (
        <ul className="grid gap-2">
          {flagged.map((s) => (
            <li key={s.key} className="grid gap-2 rounded-lg border p-3" data-testid="recheck-flag">
              <p className="text-sm">{s.text}</p>
              {s.checks && <p className="text-xs text-muted-foreground">{problemReason(s.checks)}</p>}
              <Input aria-label="Reason to keep it" placeholder="Reason to keep it" value={reasons[s.key] ?? ''} onChange={(e) => setReasons((r) => ({ ...r, [s.key]: e.target.value }))} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit} disabled={busy}>
          <PencilIcon /> Edit again
        </Button>
        {failed ? (
          <Button onClick={() => onRecheck([])} disabled={busy}>
            {busy ? <Spinner /> : <RotateCwIcon />} Run checks again
          </Button>
        ) : (
          flagged.length > 0 &&
          channel.length === 0 && (
            <Button onClick={() => onRecheck(keep)} disabled={busy || !allReasons}>
              {busy ? <Spinner /> : <RotateCwIcon />} Keep them and check again
            </Button>
          )
        )}
      </div>
    </div>
  );
}
