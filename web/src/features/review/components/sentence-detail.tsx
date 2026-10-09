import { ShieldAlertIcon, XIcon } from 'lucide-react';
import type { DraftSentence } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { checkError, hasChecks } from '../lib/checks';
import { TRACEABILITY } from '@/lib/labels';
import type { RunClaim } from '../lib/types';
import { CitedClaims } from './cited-claims';
import { DetailSection } from './detail-section';
import { RepetitionDetail } from './repetition-detail';
import { VoiceDetail } from './voice-detail';

interface SentenceDetailProps {
  sentence: DraftSentence;
  claims: Map<string, RunClaim>;
  checksVisible: boolean;
  enforce: boolean;
  onClose: () => void;
}

/** Everything known about one sentence: whether the source backs it, what it cites, and what it repeats. */
export function SentenceDetail({ sentence, claims, checksVisible, enforce, onClose }: SentenceDetailProps) {
  const checks = hasChecks(sentence.checks) ? sentence.checks : null;
  const error = checkError(sentence.checks);
  const cited = sentence.supports.flatMap((id) => claims.get(id) ?? []);
  const t = checks?.traceability;

  return (
    <Card className="gap-4 py-4 shadow-xs" aria-label="Selected sentence">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Selected sentence</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-7" onClick={onClose} aria-label="Close sentence details">
            <XIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 px-4">
        <p className="rounded-md bg-muted px-3 py-2 text-sm leading-relaxed">{sentence.text}</p>
        {enforce && sentence.blocking && (
          <Alert>
            <ShieldAlertIcon className="text-unsupported" />
            <AlertTitle>This sentence blocks accepting</AlertTitle>
            <AlertDescription>When you accept, remove it, edit it, or keep it with a written reason.</AlertDescription>
          </Alert>
        )}
        {!checksVisible && <p className="text-sm text-muted-foreground">Check results for this draft appear after you decide.</p>}
        {checksVisible && error && <p className="text-sm text-unsupported">The checks could not run on this sentence: {error}</p>}
        {t && (
          <DetailSection title={TRACEABILITY[t.status]} tone={t.status}>
            <p>{t.reason}</p>
            {t.type === 'connective' && <p className="text-xs">A connecting sentence: it makes no claim of its own.</p>}
          </DetailSection>
        )}
        <CitedClaims claims={cited} />
        {checks && <RepetitionDetail repetition={checks.repetition} />}
        {checks && <VoiceDetail voice={checks.voice} />}
      </CardContent>
    </Card>
  );
}

export function SentenceHint() {
  return (
    <Card className="py-4 shadow-xs">
      <CardContent className="px-4 text-sm text-muted-foreground">Select a sentence to see what it rests on: the quote it cites, the check result and anything you posted before that is close to it.</CardContent>
    </Card>
  );
}
